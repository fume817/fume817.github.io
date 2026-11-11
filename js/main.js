/**
 * main.js
 * アプリケーションのメイン制御・条件分岐・イベントリスナー
 */

import { getMyInfo, saveMyInfo } from "./db.js";
import { checkPeerIdConflict } from "./session.js";
import * as UI from "./UI.js";

// 新規登録フロー用の一時データ
const regData = {
  name: "",
  peerId: "",
};

/**
 * 初期化処理 (MyDBの登録チェックと画面初期表示)
 */
async function initializeApp() {
  console.log("[main.js] 初期化処理を開始");

  // 安全タイマー: 万が一IndexedDBの応答が遅延しても2秒後には確実に画面を表示
  const fallbackTimer = setTimeout(() => {
    const loading = document.getElementById("loadingView");
    if (loading && loading.style.display !== "none") {
      console.warn("[main.js] 初期化がタイムアウトしたため、新規登録画面を強制表示します");
      UI.showInitialView("first");
    }
  }, 1500);

  try {
    // 1. MyDBに自身のPeerIDが登録されているかを確認
    const myInfo = await getMyInfo();
    clearTimeout(fallbackTimer);

    if (myInfo && myInfo.peerId) {
      // --- 既に登録されている場合 ---
      console.log("[main.js] 登録済みアカウントを発見:", myInfo);
      UI.setRegisteredUserInfo(myInfo);
      UI.showInitialView("second");
    } else {
      // --- 未登録の場合 ---
      console.log("[main.js] 未登録のため、新規登録画面を表示します");
      UI.showInitialView("first");
    }
  } catch (error) {
    clearTimeout(fallbackTimer);
    console.error("[main.js] MyDBの確認中にエラーが発生しました:", error);
    UI.showInitialView("first");
  }

  // 2. 各種ボタン・入力のイベントリスナーを設定
  setupEventListeners();
}

// モジュール読み込み完了時の実行
// (DOMContentLoadedがすでに発火済みの場合でも確実に実行されるように判定)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  // すでにDOMが構築されている場合は即座に実行
  initializeApp();
}

/**
 * 画面内の各種ボタン・入力のイベントリスナーを設定
 */
function setupEventListeners() {
  const usernameInput = document.getElementById("username");
  const peerIdInput = document.getElementById("PeerID");
  const nextToStep2Btn = document.getElementById("nextToStep2");
  const registerIdBtn = document.getElementById("registerIdBtn");
  const backToStep1Btn = document.getElementById("backToStep1");
  const backToStep2Btn = document.getElementById("backToStep2");
  const startChatBtn = document.getElementById("btn");
  const scndStartChatBtn = document.getElementById("scndStartChatBtn");
  const editProfileBtn = document.getElementById("editProfileBtn");
  const generateRandomIdBtn = document.getElementById("generateRandomIdBtn");

  // --- 入力時のエラー自動解除 ---
  if (usernameInput) {
    usernameInput.addEventListener("input", () => UI.clearError());
    usernameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleStep1Next();
      }
    });
  }

  if (peerIdInput) {
    peerIdInput.addEventListener("input", () => UI.clearError());
    peerIdInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleStep2Next();
      }
    });
  }

  // --- ランダムPeerID生成ボタン ---
  if (generateRandomIdBtn && peerIdInput) {
    generateRandomIdBtn.addEventListener("click", () => {
      const randomId = "user_" + Math.random().toString(36).substring(2, 10);
      peerIdInput.value = randomId;
      UI.clearError();
    });
  }

  // --- ステップ1: ユーザー名入力から「次へ」 ---
  if (nextToStep2Btn) {
    nextToStep2Btn.addEventListener("click", handleStep1Next);
  }

  function handleStep1Next() {
    const username = usernameInput ? usernameInput.value.trim() : "";
    if (!username) {
      UI.showError("ユーザー名を入力してください", usernameInput);
      return;
    }
    if (username.length > 20) {
      UI.showError("ユーザー名は20文字以内で入力してください", usernameInput);
      return;
    }

    regData.name = username;
    UI.clearError();
    UI.transitionStep(1, 2);
  }

  // --- ステップ2: PeerID登録から「次へ(確認)」 ---
  if (registerIdBtn) {
    registerIdBtn.addEventListener("click", handleStep2Next);
  }

  async function handleStep2Next() {
    const peerId = peerIdInput ? peerIdInput.value.trim() : "";
    if (!peerId) {
      UI.showError("PeerIDを入力してください", peerIdInput);
      return;
    }

    const peerIdRegex = /^[a-zA-Z0-9_-]{3,32}$/;
    if (!peerIdRegex.test(peerId)) {
      UI.showError("IDは3〜32文字の半角英数字・ハイフン・アンダースコアで入力してください", peerIdInput);
      return;
    }

    // Peer.jsのシグナリングサーバーに問い合わせて競合（重複）チェック
    try {
      UI.setButtonLoading(registerIdBtn, "IDの競合を確認中...");
      const result = await checkPeerIdConflict(peerId);
      UI.resetButton(registerIdBtn);

      if (!result.ok) {
        UI.showError(result.message || "ほかのIDを試してください", peerIdInput);
        return;
      }

      // 競合なし！利用可能なIDが確定
      regData.peerId = peerId;
      UI.clearError();
      UI.updateConfirmInfo(regData.name, regData.peerId);
      UI.transitionStep(2, 3);
    } catch (err) {
      console.error("ID競合確認中に例外が発生しました:", err);
      UI.resetButton(registerIdBtn);
      UI.showError("IDの確認中にエラーが発生しました。もう一度お試しください", peerIdInput);
    }
  }

  // --- ステップ戻るボタン ---
  if (backToStep1Btn) {
    backToStep1Btn.addEventListener("click", () => {
      UI.clearError();
      UI.transitionStep(2, 1);
    });
  }

  if (backToStep2Btn) {
    backToStep2Btn.addEventListener("click", () => {
      UI.clearError();
      UI.transitionStep(3, 2);
    });
  }

  // --- ステップ3: 登録完了 & チャット開始 ---
  if (startChatBtn) {
    startChatBtn.addEventListener("click", async () => {
      if (!regData.name || !regData.peerId) {
        UI.showError("登録情報に不備があります。もう一度入力してください。");
        UI.transitionStep(3, 1);
        return;
      }

      try {
        UI.setButtonLoading(startChatBtn, "登録中...");
        await saveMyInfo(regData.name, regData.peerId);
        UI.animateAndNavigate("chat.html");
      } catch (error) {
        console.error("登録処理に失敗しました:", error);
        UI.resetButton(startChatBtn);
        UI.showError("登録に失敗しました。もう一度お試しください。");
      }
    });
  }

  // --- 登録済みユーザー画面（ようこそ）の「チャット開始」 ---
  if (scndStartChatBtn) {
    scndStartChatBtn.addEventListener("click", () => {
      UI.animateAndNavigate("chat.html");
    });
  }

  // --- 登録情報の変更・再登録ボタン ---
  if (editProfileBtn) {
    editProfileBtn.addEventListener("click", async () => {
      const myInfo = await getMyInfo();
      if (myInfo) {
        if (usernameInput) usernameInput.value = myInfo.name || "";
        if (peerIdInput) peerIdInput.value = myInfo.peerId || "";
      }
      UI.showInitialView("first");
    });
  }
}
