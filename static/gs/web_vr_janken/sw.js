"use strict";
const version = '1.0.0';
const CACHE = version + '::WebVR_Janken';
const offlineURL = './';

const installFilesEssential = [
  './audio/nc74722.mp3',
  './img/janken_choki.png',
  './img/janken_gu.png',
  './img/janken_pa.png',
  './mmd/alicia/MMD/Alicia_body.tga',
  './mmd/alicia/MMD/Alicia_face.tga',
  './mmd/alicia/MMD/Alicia_hair.tga',
  './mmd/alicia/MMD/Alicia_other.tga',
  './mmd/alicia/MMD/Alicia_wear.tga'
].concat(offlineURL),
  //必須ではないCache（ErrorがでてもActivateする）
  installFilesDesirable = [


  ];

//*************************************************************************
//Install
//*************************************************************************
//Install static assets
function installStaticFiles() {
  return caches.open(CACHE).then(cache => {
    cache.addAll(installFilesDesirable);        //cache desirable files
    return cache.addAll(installFilesEssential); //cache essential files
  });
}

//Application installation
self.addEventListener('install', event => {
  console.log('service worker: install');
  // cache core files
  event.waitUntil(
    installStaticFiles().then(() => self.skipWaiting()) //強制的に新しいSWに入れ替えさせるskipWaiting()
  );
});

//*************************************************************************
// Activated
//*************************************************************************
//clear old caches
function clearOldCaches() {
  return caches.keys()
    .then(keylist => {
      return Promise.all(
        keylist
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      );
    });
}

// application activated
self.addEventListener('activate', event => {
  console.log('service worker: activate');
  // delete old caches
  event.waitUntil(
    clearOldCaches().then(() => self.clients.claim()) //clients.claim()で初回アクセス時のページを制御
  );
});

// is image URL?
let iExt = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tga', 'psd', 'fbx'].map(f => '.' + f);
function isImage(url) {
  return iExt.reduce((ret, ext) => ret || url.endsWith(ext), false);
}

//return Offline asset
function offlineAsset(url) {
  if (isImage(url)) {
    return new Response(
      '<svg role="img" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><title>offline</title><path d="M0 0h400v300H0z" fill="#eee" /><text x="200" y="150" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="50" fill="#ccc">offline</text></svg>',
      {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-store'
        }
      }
    );
  } else {
    return caches.match(offlineURL);
  }
}

//*************************************************************************
//Cache OR Network
//*************************************************************************
// application fetch network data
self.addEventListener('fetch', event => {
  // abandon non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  //URLを取得
  let url = event.request.url;

  //Cacheにファイルが存在すればCacheファイル、存在しない場合Networkから取得
  event.respondWith(
    caches.open(CACHE) //CHACHEストレージにアクセス
      .then(cache => {
        return cache.match(event.request)
          .then(response => {

            //キャッシュファイルが存在していいればキャッシュを返す
            if (response) {
              console.log('cache fetch: ' + url);
              return response;
            }

            // 上記にキャッシュファイルが無い → Network request
            return fetch(event.request)
              .then(newreq => {
                if (newreq.ok) cache.put(event.request, newreq.clone());
                return newreq;
              })
              //オフライン時の処理（オフラインページ OR オフラインイメージ）
              .catch(() => offlineAsset(url));
          });
      })
  );
});
