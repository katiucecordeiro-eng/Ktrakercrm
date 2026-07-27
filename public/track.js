/*!
 * KTracker CRM — script de rastreamento first-party
 * <script src="https://SEUDOMINIO/track.js" data-offer="slug-da-oferta" defer></script>
 */
(function () {
  "use strict";

  // ── modo debug (opt-in via ?ktrk_debug=1 na URL ou localStorage) ─────
  // Só ativa logs extras no console; não muda nada do comportamento em
  // produção quando desligado.
  var DEBUG = false;
  try {
    if (new URLSearchParams(window.location.search).get("ktrk_debug") === "1") {
      localStorage.setItem("ktrk_debug", "1");
    }
    DEBUG = localStorage.getItem("ktrk_debug") === "1";
  } catch (e) {
    /* localStorage indisponível — segue sem debug */
  }

  var scriptEl = document.currentScript;

  if (!scriptEl) {
    console.warn(
      "[ktracker] document.currentScript é null — o <script> provavelmente foi " +
        "injetado via JavaScript/innerHTML em vez de estar no HTML estático da " +
        "página. Nesse caso o rastreamento não consegue ler o atributo data-offer.",
    );
    return;
  }

  var OFFER = scriptEl.getAttribute("data-offer");
  var API_URL =
    scriptEl.getAttribute("data-api") ||
    (function () {
      try {
        return new URL("/api/track", scriptEl.src).toString();
      } catch (e) {
        return "/api/track";
      }
    })();

  if (!OFFER) {
    console.warn("[ktracker] atributo data-offer não encontrado no <script>");
    return;
  }

  if (DEBUG) console.info("[ktracker] modo debug ativo — offer:", OFFER, "api:", API_URL);

  // ── utilidades ──────────────────────────────────────────────────────
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getCookie(name) {
    var match = document.cookie.match(
      new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"),
    );
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value, days) {
    var expires = "";
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie =
      name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax";
  }

  function safeGet(storage, key) {
    try {
      return storage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSet(storage, key, value) {
    try {
      storage.setItem(key, value);
    } catch (e) {
      /* localStorage indisponível (modo privado etc.) — segue só com cookie */
    }
  }

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function deviceType() {
    var ua = navigator.userAgent || "";
    if (/tablet|ipad/i.test(ua)) return "tablet";
    if (/mobi|android|iphone/i.test(ua)) return "mobile";
    return "desktop";
  }

  // ── visitor_id (cookie 1 ano + localStorage) ──────────────────────
  var visitorId = getCookie("ktrk_vid") || safeGet(localStorage, "ktrk_vid") || uuid();
  setCookie("ktrk_vid", visitorId, 365);
  safeSet(localStorage, "ktrk_vid", visitorId);

  var isNewVisitor = !getCookie("ktrk_seen");
  setCookie("ktrk_seen", "1", 365);

  // ── fbp / fbc (gera se o pixel do navegador não estiver presente) ──
  var fbp = getCookie("_fbp");
  if (!fbp) {
    fbp = "fb.1." + Date.now() + "." + Math.floor(Math.random() * 2147483647);
    setCookie("_fbp", fbp, 90);
  }

  var fbclid = getParam("fbclid");
  var fbc = getCookie("_fbc");
  if (!fbc && fbclid) {
    fbc = "fb.1." + Date.now() + "." + fbclid;
    setCookie("_fbc", fbc, 90);
  }

  var gaCookie = getCookie("_ga");
  var gaClientId = null;
  if (gaCookie) {
    var gaParts = gaCookie.split(".");
    if (gaParts.length >= 4) gaClientId = gaParts[2] + "." + gaParts[3];
  }

  // ── UTMs + landing page (first-touch, gravado uma única vez) ───────
  var utm = {
    utm_source: getParam("utm_source"),
    utm_medium: getParam("utm_medium"),
    utm_campaign: getParam("utm_campaign"),
    utm_content: getParam("utm_content"),
    utm_term: getParam("utm_term"),
  };

  var landingPage = safeGet(localStorage, "ktrk_landing");
  if (!landingPage) {
    landingPage = window.location.href;
    safeSet(localStorage, "ktrk_landing", landingPage);
  }

  // ── envio de eventos ────────────────────────────────────────────────
  function send(eventName, customData) {
    var eventId = uuid();
    window.trk.lastEventId = eventId;

    var payload = {
      offer_slug: OFFER,
      visitor_id: visitorId,
      event_name: eventName,
      event_id: eventId,
      page_url: window.location.href,
      referrer: document.referrer || null,
      landing_page: landingPage,
      is_new_visitor: isNewVisitor,
      device_type: deviceType(),
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_content: utm.utm_content,
      utm_term: utm.utm_term,
      fbclid: fbclid,
      fbp: fbp,
      fbc: fbc,
      ga_client_id: gaClientId,
      custom_data: customData || {},
    };

    var body = JSON.stringify(payload);

    if (DEBUG) {
      console.info("[ktracker] enviando", eventName, payload);
      fetch(API_URL, {
        method: "POST",
        body: body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      })
        .then(function (res) {
          if (res.ok) {
            console.info("[ktracker] " + eventName + " aceito (HTTP " + res.status + ")");
          } else {
            res.json().then(
              function (json) {
                console.error("[ktracker] " + eventName + " REJEITADO (HTTP " + res.status + ")", json);
              },
              function () {
                console.error("[ktracker] " + eventName + " REJEITADO (HTTP " + res.status + ")");
              },
            );
          }
        })
        .catch(function (err) {
          console.error("[ktracker] " + eventName + " falha de rede", err);
        });
      return eventId;
    }

    if (navigator.sendBeacon) {
      var blob = new Blob([body], { type: "text/plain" });
      var ok = navigator.sendBeacon(API_URL, blob);
      if (ok) return eventId;
    }

    fetch(API_URL, {
      method: "POST",
      body: body,
      headers: { "Content-Type": "text/plain" },
      keepalive: true,
    }).catch(function () {
      /* falha de rede não pode quebrar a página de vendas */
    });

    return eventId;
  }

  window.trk = send;
  window.trk.lastEventId = null;

  // ── reescrita de links de checkout Hotmart (sck + src) ─────────────
  var HOTMART_RE = /(^|\.)hotmart\.com$/i;

  function isHotmartLink(href) {
    try {
      var url = new URL(href, window.location.href);
      return HOTMART_RE.test(url.hostname);
    } catch (e) {
      return false;
    }
  }

  function rewriteLink(anchor) {
    if (!anchor || anchor.__ktrkRewritten) return;
    var href = anchor.getAttribute("href");
    if (!href || !isHotmartLink(href)) return;
    try {
      var url = new URL(href, window.location.href);
      url.searchParams.set("sck", visitorId);
      if (utm.utm_source) url.searchParams.set("src", utm.utm_source);
      anchor.setAttribute("href", url.toString());
      anchor.__ktrkRewritten = true;
    } catch (e) {
      /* href inválido — ignora */
    }
  }

  function rewriteAllLinks() {
    var links = document.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) rewriteLink(links[i]);
  }

  document.addEventListener(
    "click",
    function (event) {
      var anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (anchor) {
        rewriteLink(anchor);
        if (anchor.__ktrkRewritten) {
          send("InitiateCheckout", { link_url: anchor.href });
        }
      }

      // ── cliques em qualquer elemento com data-track="Nome do Evento" ──
      var trackEl = event.target && event.target.closest ? event.target.closest("[data-track]") : null;
      if (trackEl) {
        var trackName = trackEl.getAttribute("data-track");
        if (trackName) {
          send(trackName, {
            element_tag: trackEl.tagName.toLowerCase(),
            element_text: (trackEl.textContent || "").trim().slice(0, 200),
          });
        }
      }
    },
    true,
  );

  // ── vídeo: <video> nativo + embeds do YouTube/Vimeo ─────────────────
  var boundVideos = typeof WeakSet !== "undefined" ? new WeakSet() : null;

  function videoLabel(video) {
    return (
      video.getAttribute("data-video-name") ||
      video.currentSrc ||
      video.getAttribute("src") ||
      video.id ||
      "video"
    );
  }

  function bindHtml5Video(video) {
    if (boundVideos) {
      if (boundVideos.has(video)) return;
      boundVideos.add(video);
    } else {
      if (video.__ktrkBound) return;
      video.__ktrkBound = true;
    }
    var played = false;
    var completed = false;
    video.addEventListener("play", function () {
      if (played) return;
      played = true;
      send("VideoPlay", { video: videoLabel(video) });
    });
    video.addEventListener("ended", function () {
      if (completed) return;
      completed = true;
      send("VideoComplete", { video: videoLabel(video) });
    });
  }

  // Embeds do YouTube/Vimeo exigem habilitar a API deles via querystring
  // pra emitirem postMessage de mudança de estado (play/completo). Não foi
  // possível validar esse fluxo contra um player ao vivo neste ambiente
  // (sem acesso de rede aos domínios deles) — se o evento não disparar
  // pra algum embed específico, conferir se o src original já tinha algum
  // parâmetro de API conflitante antes da reescrita abaixo.
  var YOUTUBE_HOST_RE = /(^|\.)(youtube\.com|youtube-nocookie\.com)$/i;
  var VIMEO_HOST_RE = /(^|\.)player\.vimeo\.com$/i;
  var embedState = {};
  var embedCounter = 0;

  function bindEmbed(iframe) {
    if (iframe.__ktrkEmbedId) return;
    var src = iframe.getAttribute("src");
    if (!src) return;

    var url;
    try {
      url = new URL(src, window.location.href);
    } catch (e) {
      return;
    }

    var isYouTube = YOUTUBE_HOST_RE.test(url.hostname) && /\/embed\//.test(url.pathname);
    var isVimeo = VIMEO_HOST_RE.test(url.hostname);
    if (!isYouTube && !isVimeo) return;

    embedCounter += 1;
    var id = "ktrk-embed-" + embedCounter;
    iframe.__ktrkEmbedId = id;
    embedState[id] = {
      type: isYouTube ? "youtube" : "vimeo",
      played: false,
      completed: false,
      iframe: iframe,
    };

    var changed = false;
    if (isYouTube) {
      if (!url.searchParams.get("enablejsapi")) {
        url.searchParams.set("enablejsapi", "1");
        changed = true;
      }
      if (!url.searchParams.get("origin")) {
        url.searchParams.set("origin", window.location.origin);
        changed = true;
      }
    } else {
      if (!url.searchParams.get("api")) {
        url.searchParams.set("api", "1");
        changed = true;
      }
    }
    if (changed) iframe.setAttribute("src", url.toString());

    iframe.addEventListener("load", function () {
      try {
        if (isYouTube) {
          iframe.contentWindow.postMessage(JSON.stringify({ event: "listening", id: id }), "*");
        } else {
          ["play", "ended"].forEach(function (name) {
            iframe.contentWindow.postMessage(
              JSON.stringify({ method: "addEventListener", value: name }),
              "*",
            );
          });
        }
      } catch (e) {
        /* postMessage cross-origin nunca deve quebrar a página */
      }
    });
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return;
      }
    }
    if (!data || typeof data !== "object") return;

    for (var id in embedState) {
      if (!Object.prototype.hasOwnProperty.call(embedState, id)) continue;
      var state = embedState[id];
      if (state.iframe.contentWindow !== event.source) continue;

      if (state.type === "youtube" && data.info && typeof data.info.playerState !== "undefined") {
        if (data.info.playerState === 1 && !state.played) {
          state.played = true;
          send("VideoPlay", { video: state.iframe.getAttribute("src") });
        }
        if (data.info.playerState === 0 && !state.completed) {
          state.completed = true;
          send("VideoComplete", { video: state.iframe.getAttribute("src") });
        }
      } else if (state.type === "vimeo" && data.event === "play" && !state.played) {
        state.played = true;
        send("VideoPlay", { video: state.iframe.getAttribute("src") });
      } else if (state.type === "vimeo" && data.event === "ended" && !state.completed) {
        state.completed = true;
        send("VideoComplete", { video: state.iframe.getAttribute("src") });
      }
      break;
    }
  });

  function scanVideos() {
    var videos = document.querySelectorAll("video");
    for (var i = 0; i < videos.length; i++) bindHtml5Video(videos[i]);

    var iframes = document.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"]');
    for (var j = 0; j < iframes.length; j++) bindEmbed(iframes[j]);
  }

  // ── visibilidade de seção: elementos com data-track-view="Nome" ──────
  var sectionsSent = typeof WeakSet !== "undefined" ? new WeakSet() : null;
  var sectionObserver = null;
  if (window.IntersectionObserver) {
    sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          if (sectionsSent) {
            if (sectionsSent.has(el)) return;
            sectionsSent.add(el);
          } else {
            if (el.__ktrkViewSent) return;
            el.__ktrkViewSent = true;
          }
          var name = el.getAttribute("data-track-view");
          if (name) send(name, { section: name });
          sectionObserver.unobserve(el);
        });
      },
      { threshold: 0.5 },
    );
  }

  function scanSections() {
    if (!sectionObserver) return;
    var sections = document.querySelectorAll("[data-track-view]");
    for (var i = 0; i < sections.length; i++) {
      if (!sections[i].__ktrkObserved) {
        sections[i].__ktrkObserved = true;
        sectionObserver.observe(sections[i]);
      }
    }
  }

  function scanNewContent() {
    rewriteAllLinks();
    scanVideos();
    scanSections();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scanNewContent);
  } else {
    scanNewContent();
  }

  if (window.MutationObserver) {
    new MutationObserver(scanNewContent).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // ── PageView automático + duração no unload ─────────────────────────
  var pageLoadedAt = Date.now();
  send("PageView");

  var scrollMarks = { 50: false, 90: false };
  window.addEventListener(
    "scroll",
    function () {
      var doc = document.documentElement;
      var scrolled = doc.scrollHeight <= doc.clientHeight
        ? 100
        : ((doc.scrollTop / (doc.scrollHeight - doc.clientHeight)) * 100);
      [50, 90].forEach(function (mark) {
        if (!scrollMarks[mark] && scrolled >= mark) {
          scrollMarks[mark] = true;
          send("Scroll" + mark);
        }
      });
    },
    { passive: true },
  );

  var durationSent = false;
  function sendDuration() {
    if (durationSent) return;
    durationSent = true;
    send("PageDuration", { duration_seconds: Math.round((Date.now() - pageLoadedAt) / 1000) });
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") sendDuration();
  });
  window.addEventListener("pagehide", sendDuration);
})();
