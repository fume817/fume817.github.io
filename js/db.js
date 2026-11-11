//会話内容を引数で受け取り保存と出力
import { openDB } from "idb";

//--------自身の情報を保存するDB----------
//自分の名前とPeerIDを保存するDB
const MyDB = openDB("MyDB", 1, {
  upgrade(db) {
    const store = db.createObjectStore("MyDB", {
      keyPath: "id",
      autoIncrement: true,
    });
    store.createIndex("peerId", "peerId", { unique: true });
  },
});

/**
 * 自身のユーザー情報(名前・PeerID)を取得
 * @returns {Promise<{id?: number, name: string, peerId: string}|null>}
 */
export async function getMyInfo() {
  const db = await MyDB;
  const all = await db.getAll("MyDB");
  return all && all.length > 0 ? all[0] : null;
}

/**
 * 自身のPeerIDが登録されているかどうかを確認
 * @returns {Promise<boolean>}
 */
export async function isRegistered() {
  const user = await getMyInfo();
  return Boolean(user && user.peerId);
}

/**
 * 自身のユーザー情報を登録・更新
 * @param {string} name
 * @param {string} peerId
 * @returns {Promise<{id?: number, name: string, peerId: string}>}
 */
export async function saveMyInfo(name, peerId) {
  const db = await MyDB;
  const all = await db.getAll("MyDB");
  if (all && all.length > 0) {
    const existing = all[0];
    existing.name = name;
    existing.peerId = peerId;
    existing.updatedAt = Date.now();
    await db.put("MyDB", existing);
    return existing;
  } else {
    const newUser = {
      name,
      peerId,
      createdAt: Date.now(),
    };
    const id = await db.add("MyDB", newUser);
    return { id, ...newUser };
  }
}

/**
 * 自身の情報を削除(デバッグ・初期化用)
 */
export async function clearMyInfo() {
  const db = await MyDB;
  await db.clear("MyDB");
}

//--------過去に会話した相手の名簿DB----------

//相手の表示名と紐ついているPeerIDを保存する
//companion・・・相手とかの意味
const companionDB = openDB("companionDB", 1, {
  upgrade(db) {
    const store = db.createObjectStore("companion", {
      keyPath: "id",
      autoIncrement: true,
    });
    store.createIndex("peerId", "peerId", { unique: true });
    store.createIndex("lastChatAT", "lastChatAT");
  },
});


//登録するオブジェクト(ユーザー名,peerID)
//チャット相手の一覧表示
export async function addCompanion(name, peerId) {
  const db = await companionDB;
  if (peerId) {
    return db.add("companion", { name, peerId });           //returnしなくてもよいがawaitにするかのどっちかならとりあえず返し得？
  }
}

/**
 * チャット相手の一覧を取得
 * @returns {Promise<Array<{id: number, name: string, peerId: string, lastChatAT?: number}>>}
 */
export async function getCompanions() {
  const db = await companionDB;
  return db.getAll("companion");
}

//最終チャット日時を更新する関数
export async function addTime(peerid) {
  const db = await companionDB;
  const companion = await db.getFromIndex("companion", "peerId", peerid);
  if (companion) {
    companion.lastChatAT = Date.now();
    await db.put("companion", companion);
  }
}

//----------相手とのチャット履歴のDB----------

//チャット内容とユーザーを紐付けるmapオブジェクトの形で
// DBsにcompanionIDをキーにしてDBを紐付けている
const chatDBs = new Map();
function getChatDB(companionId) {
  // exportしない = privateな内部関数
  if (!chatDBs.has(companionId)) {
    chatDBs.set(
      companionId,
      openDB(companionId + "_chatDB", 1, {
        upgrade(db) {
          db.createObjectStore("user", { keyPath: "id" });
          const store = db.createObjectStore("chats", {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("type", "type");
        },
      }),
    );
  }
  return chatDBs.get(companionId);
}

//【 カラム】
//me 0 or 1
//type image or file or text
//content 実際の文章やファイルや画像や動画
//createdAt 作成日時
export async function addChat(companionId, chat) {
  const db = await getChatDB(companionId);
  //ミリ秒表示で可読的なフォーマットではないため表示時に変換
  return db.add("chats", { ...chat, createdAt: Date.now() });          //...で{}で受け取る中身を展開している
}

/**
 * 特定の相手とのチャット履歴を全件取得
 * @param {string} companionId
 * @returns {Promise<Array<{id: number, me: number, type: string, content: any, createdAt: number}>>}
 */
export async function getChats(companionId) {
  const db = await getChatDB(companionId);
  return db.getAll("chats");
}

