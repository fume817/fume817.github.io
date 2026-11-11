/**
 * chat.js
 * チャット画面のメイン制御スクリプト
 * DB認証チェック、P2P通信連動、メッセージ送受信、画像送信、相手名簿管理
 */

import { getMyInfo, isRegistered, addChat, getChats, addCompanion, addTime, getCompanions } from "./db.js";
import { initChatSession, connectToPeer, sendP2PMessage, getActivePeerId } from "./session.js";
import * as UI from "./UI.js";

// 現在会話中の相手のPeerID
let currentCompanionId = null;
let myProfile = null;

async function initializeChat() {
  try {
    // 1. MyDBに自身のPeerIDが登録されているか確認
    const registered = await isRegistered();
    if (!registered) {
      console.warn("ユーザー情報が未登録のため、index.htmlにリダイレクトします");
      window.location.href = "index.html";
      return;
    }

    // 2. 自身のプロファイル情報を取得・表示
    myProfile = await getMyInfo();
    const usernameDisplay = document.getElementById("usernameDisplay");
    const profileName = document.querySelector("#profile p");

    if (usernameDisplay && myProfile) {
      usernameDisplay.textContent = myProfile.name || "ユーザー";
    }
    if (profileName && myProfile) {
      profileName.textContent = `${myProfile.name}`;
    }

    // 3. Peer.jsで自身のP2P待機セッションを開始
    await initChatSession(myProfile.peerId, {
      onMessage: handleIncomingMessage,
      onStatusChange: handleStatusChange,
      onConnected: handlePeerConnected,
    });

    // 4. イベントリスナーの設定
    setupChatEventListeners();

    // 5. 過去のチャット相手リスト（コンパニオン）を読み込んでサイドバーに表示
    await refreshCompanionsList();
  } catch (error) {
    console.error("チャット画面初期化中にエラーが発生しました:", error);
    UI.updateChatStatus("初期化エラー", "error");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeChat);
} else {
  initializeChat();
}

/**
 * 相手からの接続確立時のハンドラ
 * @param {string} peerId
 */
async function handlePeerConnected(peerId) {
  currentCompanionId = peerId;
  console.log(`チャット相手が確定: ${peerId}`);

  // 相手をコンパニオンDBに登録 & 最終通信日時更新
  await addCompanion(peerId, peerId);
  await addTime(peerId);

  // チャットヘッダー更新
  UI.updateChatHeader(peerId, peerId);

  // 接続待機パネルを隠してチャット画面を表示
  UI.setFirstChatVisible(false);

  // 過去の会話履歴を読み出して描画
  const history = await getChats(peerId);
  UI.renderChatHistory(history);
  UI.updateChatStatus(`接続中: ${peerId}`, "connected");

  // サイドバーの相手一覧を更新
  await refreshCompanionsList();
}

/**
 * 相手からのP2Pメッセージ受信ハンドラ
 * @param {object|string} data
 * @param {string} senderPeerId
 */
async function handleIncomingMessage(data, senderPeerId) {
  const content = typeof data === "object" ? data.content || data.text || JSON.stringify(data) : String(data);
  const type = (typeof data === "object" && data.type) || "text";

  const chatRecord = {
    me: 0, // 相手からの受信メッセージ
    type: type,
    content: content,
    createdAt: Date.now(),
  };

  // 1. 会話をIndexedDBに保存
  await addChat(senderPeerId, chatRecord);
  await addTime(senderPeerId);

  // 2. 現在その相手のチャット画面を開いていればUIに吹き出しを追加
  if (currentCompanionId === senderPeerId) {
    UI.appendChatBubble(chatRecord);
  } else {
    console.log(`別ユーザー(${senderPeerId})からの新着メッセージを受信`);
    await refreshCompanionsList();
  }
}

/**
 * 通信ステータス変更時のハンドラ
 * @param {string} message
 * @param {string} state
 */
function handleStatusChange(message, state) {
  UI.updateChatStatus(message, state);
}

/**
 * チャット画面の各種イベントリスナー
 */
function setupChatEventListeners() {
  const messageInput = document.getElementById("messageInput");
  const sendButton = document.getElementById("sendButton");
  const connectButton = document.getElementById("connectButton");
  const peerIdInput = document.getElementById("peerIdInput");
  const showConnectFormBtn = document.getElementById("showConnectFormBtn");
  const addNewCompanionBtn = document.getElementById("addNewCompanionBtn");
  const fileButton = document.getElementById("file");
  const fileInput = document.getElementById("fileInput");

  // --- メッセージ送信 ---
  if (sendButton) {
    sendButton.addEventListener("click", sendMessage);
  }

  if (messageInput) {
    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // --- 画像・ファイル送信 ---
  if (fileButton && fileInput) {
    fileButton.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", handleFileSelect);
  }

  // --- 相手への接続 ---
  if (connectButton && peerIdInput) {
    connectButton.addEventListener("click", async () => {
      const targetId = peerIdInput.value.trim();
      if (!targetId) {
        alert("相手のPeerIDを入力してください");
        peerIdInput.focus();
        return;
      }

      if (myProfile && targetId === myProfile.peerId) {
        alert("自分自身のPeerIDには接続できません");
        return;
      }

      try {
        connectButton.disabled = true;
        connectButton.textContent = "接続試行中...";

        await connectToPeer(targetId);
        await handlePeerConnected(targetId);

        connectButton.textContent = "接続";
        connectButton.disabled = false;
      } catch (err) {
        connectButton.textContent = "接続";
        connectButton.disabled = false;
        alert(`接続に失敗しました: ${err.message || "相手がオフラインかIDが存在しません"}`);
      }
    });
  }

  // --- 新規チャット作成ボタン ---
  const openNewChat = () => {
    UI.setFirstChatVisible(true);
    if (peerIdInput) peerIdInput.focus();
  };

  if (showConnectFormBtn) showConnectFormBtn.addEventListener("click", openNewChat);
  if (addNewCompanionBtn) addNewCompanionBtn.addEventListener("click", openNewChat);
}

/**
 * テキストメッセージ送信処理
 */
async function sendMessage() {
  const messageInput = document.getElementById("messageInput");
  if (!messageInput) return;

  const text = messageInput.value.trim();
  if (!text) return;

  if (!currentCompanionId) {
    alert("まずはチャット相手のPeerIDに接続してください");
    UI.setFirstChatVisible(true);
    return;
  }

  const messagePayload = {
    content: text,
    type: "text",
    senderName: myProfile ? myProfile.name : "自分",
    timestamp: Date.now(),
  };

  // 1. P2Pで相手に送信
  const sent = sendP2PMessage(messagePayload);
  if (!sent) {
    alert("相手との接続が開かれていないため送信できませんでした");
    return;
  }

  // 2. 自身のIndexedDBに保存
  const myChatRecord = {
    me: 1, // 自分からの送信
    type: "text",
    content: text,
    createdAt: Date.now(),
  };

  await addChat(currentCompanionId, myChatRecord);
  await addTime(currentCompanionId);

  // 3. UIに吹き出しを追加
  UI.appendChatBubble(myChatRecord);

  // 4. 入力欄をクリアしてフォーカス
  messageInput.value = "";
  messageInput.focus();
}

/**
 * ファイル/画像選択時の送信処理
 */
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!currentCompanionId) {
    alert("まずはチャット相手に接続してください");
    event.target.value = "";
    return;
  }

  // ファイルサイズチェック (P2P DataChannelの許容量を考慮し、2MB程度を推奨)
  if (file.size > 2 * 1024 * 1024) {
    alert("送信できるファイルサイズは2MBまでです");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;
    const isImage = file.type.startsWith("image/");
    const messageType = isImage ? "image" : "file";

    const payload = {
      type: messageType,
      content: dataUrl,
      fileName: file.name,
      senderName: myProfile ? myProfile.name : "自分",
      timestamp: Date.now(),
    };

    // P2P送信
    const sent = sendP2PMessage(payload);
    if (!sent) {
      alert("相手との接続が開かれていないためファイルを送信できませんでした");
      return;
    }

    // 自身のIndexedDBに保存
    const chatRecord = {
      me: 1,
      type: messageType,
      content: dataUrl,
      createdAt: Date.now(),
    };
    await addChat(currentCompanionId, chatRecord);
    await addTime(currentCompanionId);

    // 画面に表示
    UI.appendChatBubble(chatRecord);
    event.target.value = ""; // 入力リセット
  };

  reader.readAsDataURL(file);
}

/**
 * サイドバーの相手一覧を再読み込みして描画
 */
async function refreshCompanionsList() {
  const companions = await getCompanions();
  UI.renderCompanionList(companions, async (selectedCompanion) => {
    // 相手をクリックしたときの処理
    currentCompanionId = selectedCompanion.peerId;
    UI.updateChatHeader(selectedCompanion.name, selectedCompanion.peerId);
    UI.setFirstChatVisible(false);

    // 履歴読み出し
    const history = await getChats(selectedCompanion.peerId);
    UI.renderChatHistory(history);

    // まだP2P接続していなければ接続を試みる
    if (getActivePeerId() !== selectedCompanion.peerId) {
      try {
        UI.updateChatStatus(`接続中: ${selectedCompanion.peerId}...`, "connecting");
        await connectToPeer(selectedCompanion.peerId);
      } catch (err) {
        console.warn("相手への再接続待機中 (相手がオフラインの可能性があります)");
      }
    }
    // アクティブ状態の反映
    await refreshCompanionsList();
  }, currentCompanionId);
}
