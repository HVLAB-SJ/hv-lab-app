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
    "url": "assets/AdditionalWork-DiLtIn8n.js",
    "revision": null
  }, {
    "url": "assets/additionalWorkService-DJ_mZOyK.js",
    "revision": null
  }, {
    "url": "assets/AfterService-hclDGuvQ.js",
    "revision": null
  }, {
    "url": "assets/ConstructionPayment-BmY_xfJf.js",
    "revision": null
  }, {
    "url": "assets/Contractors-CBiW-GMG.js",
    "revision": null
  }, {
    "url": "assets/Dashboard-ohuwUbgk.js",
    "revision": null
  }, {
    "url": "assets/dataStore-KKV5TG9o.js",
    "revision": null
  }, {
    "url": "assets/Drawings-BGm-qr-P.js",
    "revision": null
  }, {
    "url": "assets/EstimatePreview-3lnNLUhR.js",
    "revision": null
  }, {
    "url": "assets/ExecutionHistory-BY5SjAsc.js",
    "revision": null
  }, {
    "url": "assets/FinishCheck-BkJ0QuLZ.js",
    "revision": null
  }, {
    "url": "assets/formatters-15aXprTM.js",
    "revision": null
  }, {
    "url": "assets/imageStorage-DjLpiDnu.js",
    "revision": null
  }, {
    "url": "assets/index-CPjW46M8.css",
    "revision": null
  }, {
    "url": "assets/index-CSlX1tQB.js",
    "revision": null
  }, {
    "url": "assets/index-D__tfnk2.js",
    "revision": null
  }, {
    "url": "assets/index.esm-CwHht2tV.js",
    "revision": null
  }, {
    "url": "assets/Login-Imk6pO6V.js",
    "revision": null
  }, {
    "url": "assets/Payments-D1bZzt1S.js",
    "revision": null
  }, {
    "url": "assets/Projects-DJLZHKKf.js",
    "revision": null
  }, {
    "url": "assets/QuoteInquiry-CbEsDoxM.js",
    "revision": null
  }, {
    "url": "assets/Schedule-B7ERkcI_.js",
    "revision": null
  }, {
    "url": "assets/Schedule-CJomsMGr.css",
    "revision": null
  }, {
    "url": "assets/ScheduleModal-BSXQkwlw.js",
    "revision": null
  }, {
    "url": "assets/SiteLog-C1AXvhDi.js",
    "revision": null
  }, {
    "url": "assets/Specbook-YITc8WXF.js",
    "revision": null
  }, {
    "url": "assets/useFilteredProjects-0AZ_Lhor.js",
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
    "url": "assets/WorkRequest-BhUXCAWM.js",
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
    "revision": "9c7cb2166f00e56042a850b36b184357"
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
