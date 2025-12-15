/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-f969db16'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();

  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "assets/AdditionalWork-_F8FZb7t.js",
    "revision": null
  }, {
    "url": "assets/additionalWorkService-D-wEd8N6.js",
    "revision": null
  }, {
    "url": "assets/AfterService-BYcm7XaQ.js",
    "revision": null
  }, {
    "url": "assets/ConstructionPayment-BEZXQk_f.js",
    "revision": null
  }, {
    "url": "assets/Contractors-LD6rO1My.js",
    "revision": null
  }, {
    "url": "assets/Dashboard-9kEd6ak3.js",
    "revision": null
  }, {
    "url": "assets/dataStore-DhBfPaYv.js",
    "revision": null
  }, {
    "url": "assets/Drawings-HKK0TjPs.js",
    "revision": null
  }, {
    "url": "assets/EstimatePreview-DuJR5aHb.js",
    "revision": null
  }, {
    "url": "assets/ExecutionHistory-CwkY07VZ.js",
    "revision": null
  }, {
    "url": "assets/FinishCheck-BNtXhnnx.js",
    "revision": null
  }, {
    "url": "assets/formatters-15aXprTM.js",
    "revision": null
  }, {
    "url": "assets/imageStorage-DjLpiDnu.js",
    "revision": null
  }, {
    "url": "assets/index-BFtQeVND.css",
    "revision": null
  }, {
    "url": "assets/index-CSlX1tQB.js",
    "revision": null
  }, {
    "url": "assets/index-CYrgc6K9.js",
    "revision": null
  }, {
    "url": "assets/index.esm-CwHht2tV.js",
    "revision": null
  }, {
    "url": "assets/Login-CBAN60vX.js",
    "revision": null
  }, {
    "url": "assets/Payments-CZEtyb2W.js",
    "revision": null
  }, {
    "url": "assets/Projects-DHzx9QMR.js",
    "revision": null
  }, {
    "url": "assets/QuoteInquiry-0_6LGs0d.js",
    "revision": null
  }, {
    "url": "assets/Schedule-CJomsMGr.css",
    "revision": null
  }, {
    "url": "assets/Schedule-DUl1sDYe.js",
    "revision": null
  }, {
    "url": "assets/ScheduleModal-UGFFQ6fc.js",
    "revision": null
  }, {
    "url": "assets/SiteLog-BCO6uu6r.js",
    "revision": null
  }, {
    "url": "assets/Specbook-Dm73fxvW.js",
    "revision": null
  }, {
    "url": "assets/useFilteredProjects-mrY8xywb.js",
    "revision": null
  }, {
    "url": "assets/vendor-calendar-DTyCd1d2.js",
    "revision": null
  }, {
    "url": "assets/vendor-data-BwGxWJIh.js",
    "revision": null
  }, {
    "url": "assets/vendor-date-9Cl9d1sr.js",
    "revision": null
  }, {
    "url": "assets/vendor-react-B9Yt5e0k.js",
    "revision": null
  }, {
    "url": "assets/vendor-ui-CcgAtStV.js",
    "revision": null
  }, {
    "url": "assets/workbox-window.prod.es5-B9K5rw8f.js",
    "revision": null
  }, {
    "url": "assets/WorkRequest-C2hT54jF.js",
    "revision": null
  }, {
    "url": "favicon.png",
    "revision": "582f19c97365121c0d77cc10e72dde51"
  }, {
    "url": "icon-192.png",
    "revision": "af42da15685186ff576f3c75eb8a68d0"
  }, {
    "url": "icon-512.png",
    "revision": "911f7d366d14c27d2ceee49236fd07c3"
  }, {
    "url": "icon.svg",
    "revision": "13c8dc084d8e721d3dbb3d62d72ae126"
  }, {
    "url": "index.html",
    "revision": "cff7dd9c9d5d1883f90d7eab55b8bcb7"
  }, {
    "url": "vite.svg",
    "revision": "8e3a10e157f75ada21ab742c022d5430"
  }, {
    "url": "favicon.png",
    "revision": "582f19c97365121c0d77cc10e72dde51"
  }, {
    "url": "icon-192.png",
    "revision": "af42da15685186ff576f3c75eb8a68d0"
  }, {
    "url": "icon-512.png",
    "revision": "911f7d366d14c27d2ceee49236fd07c3"
  }, {
    "url": "icon.svg",
    "revision": "13c8dc084d8e721d3dbb3d62d72ae126"
  }], {
    "directoryIndex": null
  });
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(/^https:\/\/api\./i, new workbox.NetworkFirst({
    "cacheName": "api-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 100,
      maxAgeSeconds: 86400
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp)$/, new workbox.CacheFirst({
    "cacheName": "image-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 2592000
    })]
  }), 'GET');

}));
