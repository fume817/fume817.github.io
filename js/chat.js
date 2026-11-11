/**
 * chat.js
 * チャット画面のメイン制御スクリプト
 * DB認証チェック、P2P通信連動、メッセージ送受信、会話履歴の保存と描画
 */

import { getMyInfo, isRegistered, addChat, getChats, addCompanion, addTime, getCompanions } from "./db.js";
import { initChatSession, connectToPeer, sendP2PMessage, getActivePeerId } from "./session.js";
import * as UI from "./UI.js";

// 現在会話中の相手のPeerID
let currentCompanionId = null;
let myProfile = null;

document.addEventListener("DOMContentLoaded", async () => {
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
      profileName.textContent = `${myProfile.name} (ID: ${myProfile.peerId})`;
    }

    // 3. Peer.jsで自身のP2P待機セッションを開始
    await initChatSession(myProfile.peerId, {
      onMessage: handleIncomingMessage,
      onStatusChange: handleStatusChange,
      onConnected: handlePeerConnected,
    });

    // 4. イベントリスナーの設定
    setupChatEventListeners();

    // 5. 過去のチャット相手リスト（コンパニオン）があれば読み込み
    await loadCompanionsList();
  } catch (error) {
    console.error("チャット画面初期化中にエラーが発生しました:", error);
    UI.updateChatStatus("初期化エラー", "error");
  }
});

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

  // 接続待機パネルを隠してチャット画面を表示
  UI.setFirstChatVisible(false);

  // 過去の会話履歴を読み出して描画
  const history = await getChats(peerId);
  UI.renderChatHistory(history);
  UI.updateChatStatus(`接続中: ${peerId}`, "connected");
}

/**
 * 相手からのP2Pメッセージ受信ハンドラ
 * @param {object|string} data
 * @param {string} senderPeerId
 */
async function handleIncomingMessage(data, senderPeerId) {
  const content = typeof data === "object" ? data.text || JSON.stringify(data) : String(data);
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
  const newChatBtn = document.querySelector("#firstChat button");

  // --- メッセージ送信 ---
  if (sendButton) {
    sendButton.addEventListener("click", sendMessage);
  }

  if (messageInput) {
    messageInput.addEventListener("keydown", (e) => {
      // Enterキーで送信 (Shift+Enterは改行)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
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
  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      UI.setFirstChatVisible(true);
      if (peerIdInput) peerIdInput.focus();
    });
  }
}

/**
 * メッセージ送信処理
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
    text: text,
    type: "text",
    senderName: myProfile ? myProfile.name : "自分",
    timestamp: Date.now(),
  };

  // 1. P2Pで相手に送信
  const sent = sendP2PMessage(messagePayload);
  if (!sent) {
    alert("相手との接続が切断されているため送信できませんでした");
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
 * 過去に会話した相手一覧（コンパニオン）の読み込み
 */
async function loadCompanionsList() {
  const companions = await getCompanions();
  console.log("過去の対話相手リスト:", companions);
}
