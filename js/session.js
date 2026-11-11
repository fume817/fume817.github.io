/**
 * session.js
 * Peer.jsを利用したP2P通信の確立・管理およびメッセージ送受信
 */

// Peerクラスの安全な取得 (window.Peer または 動的import)
async function getPeerClass() {
  if (typeof window !== "undefined" && window.Peer) {
    return window.Peer;
  }
  try {
    const mod = await import("https://esm.sh/peerjs@1.5.4");
    return mod.Peer;
  } catch (err) {
    console.warn("[session.js] esm.shからのPeerJS読み込みに失敗しました。unpkgを試みます:", err);
    try {
      const mod2 = await import("https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js");
      return window.Peer || mod2.Peer;
    } catch (e) {
      console.error("[session.js] PeerJSのロードに失敗しました:", e);
      throw new Error("PeerJSライブラリをロードできませんでした。インターネット接続を確認してください。");
    }
  }
}

// 現在アクティブなPeerインスタンス
let currentPeer = null;

// 現在接続中の相手とのDataConnection
let activeConnection = null;

// イベントコールバック用
let onMessageReceivedCallback = null;
let onStatusChangeCallback = null;
let onConnectedCallback = null;

/**
 * 入力されたPeerIDがサーバー上で競合（重複）しているかを確認
 * @param {string} peerId
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function checkPeerIdConflict(peerId) {
  let Peer;
  try {
    Peer = await getPeerClass();
  } catch (err) {
    return { ok: false, message: err.message };
  }

  return new Promise((resolve) => {
    let resolved = false;

    const testPeer = new Peer(peerId, { debug: 1 });

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { testPeer.destroy(); } catch (_) {}
        resolve({
          ok: false,
          message: "サーバー応答がタイムアウトしました。通信環境を確認してください",
        });
      }
    }, 5000);

    testPeer.on("open", (id) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        testPeer.destroy();
        resolve({ ok: true });
      }
    });

    testPeer.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        try { testPeer.destroy(); } catch (_) {}

        if (err.type === "unavailable-id") {
          resolve({
            ok: false,
            message: "そのPeerIDは既に使用されています。ほかのIDを試してください",
          });
        } else if (err.type === "invalid-id") {
          resolve({
            ok: false,
            message: "PeerIDに使用できない文字が含まれています",
          });
        } else {
          resolve({
            ok: false,
            message: `通信エラー (${err.type})。ほかのIDを試すか再接続してください`,
          });
        }
      }
    });
  });
}

/**
 * 自身のPeerIDでP2Pチャットセッションを初期化
 * @param {string} myPeerId
 * @param {object} callbacks
 * @param {function} callbacks.onMessage
 * @param {function} callbacks.onStatusChange
 * @param {function} callbacks.onConnected
 * @returns {Promise<Peer>}
 */
export async function initChatSession(myPeerId, { onMessage, onStatusChange, onConnected } = {}) {
  const Peer = await getPeerClass();

  return new Promise((resolve, reject) => {
    onMessageReceivedCallback = onMessage;
    onStatusChangeCallback = onStatusChange;
    onConnectedCallback = onConnected;

    if (currentPeer && !currentPeer.destroyed) {
      currentPeer.destroy();
    }

    notifyStatus("サーバー接続中...", "connecting");

    currentPeer = new Peer(myPeerId, { debug: 1 });

    // 1. 自身のPeerがサーバーに登録完了
    currentPeer.on("open", (id) => {
      console.log(`[Peer.js] 待機開始: 自身のPeerID = ${id}`);
      notifyStatus("接続待機中 (オンライン)", "online");
      resolve(currentPeer);
    });

    // 2. 相手からの接続要求を受信（着信）
    currentPeer.on("connection", (conn) => {
      console.log(`[Peer.js] 相手からの接続を受信: ${conn.peer}`);
      setupDataConnection(conn);
    });

    // 3. 通信エラー
    currentPeer.on("error", (err) => {
      console.error("[Peer.js] エラー発生:", err);
      if (err.type === "peer-unavailable") {
        notifyStatus("相手が見つかりません", "error");
      } else {
        notifyStatus(`エラー: ${err.type}`, "error");
      }
      reject(err);
    });

    // 4. 切断
    currentPeer.on("disconnected", () => {
      console.warn("[Peer.js] シグナリングサーバーから切断されました");
      notifyStatus("オフライン (再接続試行中...)", "offline");
    });
  });
}

/**
 * 相手のPeerIDを指定して接続を発信（発信）
 * @param {string} targetPeerId
 * @returns {Promise<DataConnection>}
 */
export function connectToPeer(targetPeerId) {
  return new Promise((resolve, reject) => {
    if (!currentPeer || currentPeer.destroyed) {
      return reject(new Error("Peerが初期化されていません"));
    }

    notifyStatus(`${targetPeerId} へ接続中...`, "connecting");

    const conn = currentPeer.connect(targetPeerId, {
      reliable: true,
    });

    setupDataConnection(conn);

    conn.on("open", () => {
      console.log(`[Peer.js] 相手(${targetPeerId})との接続が確立しました`);
      resolve(conn);
    });

    conn.on("error", (err) => {
      console.error("[Peer.js] 相手への接続エラー:", err);
      notifyStatus("接続に失敗しました", "error");
      reject(err);
    });
  });
}

/**
 * DataConnectionの送受信イベントを設定
 * @param {DataConnection} conn
 */
function setupDataConnection(conn) {
  activeConnection = conn;

  conn.on("open", () => {
    notifyStatus(`${conn.peer} と接続完了`, "connected");
    if (onConnectedCallback) {
      onConnectedCallback(conn.peer);
    }
  });

  // メッセージ受信時
  conn.on("data", (data) => {
    console.log("[Peer.js] メッセージを受信:", data);
    if (onMessageReceivedCallback) {
      onMessageReceivedCallback(data, conn.peer);
    }
  });

  conn.on("close", () => {
    console.log(`[Peer.js] ${conn.peer} との接続が切断されました`);
    notifyStatus("接続が切断されました", "disconnected");
    activeConnection = null;
  });

  conn.on("error", (err) => {
    console.error("[Peer.js] チャネルエラー:", err);
    notifyStatus("通信エラーが発生しました", "error");
  });
}

/**
 * 接続中の相手へメッセージを送信
 * @param {object|string} messageData
 * @returns {boolean} 送信成功可否
 */
export function sendP2PMessage(messageData) {
  if (!activeConnection || !activeConnection.open) {
    console.warn("[Peer.js] 送信先との接続が開かれていません");
    return false;
  }

  activeConnection.send(messageData);
  return true;
}

/**
 * ステータス変更通知ヘルパー
 */
function notifyStatus(message, state) {
  if (onStatusChangeCallback) {
    onStatusChangeCallback(message, state);
  }
}

/**
 * 現在アクティブな接続相手のPeerIDを取得
 */
export function getActivePeerId() {
  return activeConnection && activeConnection.open ? activeConnection.peer : null;
}

/**
 * 現在のPeerインスタンスを取得
 */
export function getCurrentPeer() {
  return currentPeer;
}
