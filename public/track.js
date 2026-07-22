/*!
 * KTracker CRM — script de rastreamento first-party
 * <script src="https://SEUDOMINIO/track.js" data-offer="slug-da-oferta" defer></script>
 */
(function () {
  "use strict";

  var scriptEl = document.currentScript;
  var OFFER = scriptEl ? scriptEl.getAttribute("data-offer") : null;
  var API_URL =
    (scriptEl && scriptEl.getAttribute("data-api")) ||
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
      if (!anchor) return;
      rewriteLink(anchor);
      if (anchor.__ktrkRewritten) {
        send("InitiateCheckout", { link_url: anchor.href });
      }
    },
    true,
  );

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", rewriteAllLinks);
  } else {
    rewriteAllLinks();
  }

  if (window.MutationObserver) {
    new MutationObserver(rewriteAllLinks).observe(document.documentElement, {
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
