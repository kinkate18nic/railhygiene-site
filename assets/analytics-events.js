(() => {
  "use strict";

  const GA4_DESTINATION = "G-6328SPQDYL";
  const TRAIN_NUMBER_PATTERN = /^\d{5}$/;

  const cleanParameters = (parameters) =>
    Object.fromEntries(
      Object.entries(parameters).filter(
        ([, value]) => value !== undefined && value !== null && value !== "",
      ),
    );

  window.rhTrack = (eventName, parameters = {}) => {
    if (typeof window.gtag !== "function") return;
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(eventName)) return;

    window.gtag(
      "event",
      eventName,
      cleanParameters({
        ...parameters,
        send_to: GA4_DESTINATION,
      }),
    );
  };

  const classifyLink = (link) => {
    if (link.dataset.gaEvent) return link.dataset.gaEvent;

    const rawHref = link.getAttribute("href") || "";
    if (rawHref.startsWith("intent://")) return "open_app_click";
    if (rawHref.toLowerCase() === "tel:139") return "call_139_click";

    try {
      const url = new URL(rawHref, window.location.href);
      if (url.hostname === "play.google.com") return "play_store_click";
      if (url.hostname === "railmadad.indianrailways.gov.in") {
        return "railmadad_click";
      }
      if (url.origin === window.location.origin && url.pathname === "/open") {
        return "open_app_click";
      }
      if (
        url.origin === window.location.origin &&
        url.pathname.endsWith("/dashboard.html")
      ) {
        return "dashboard_open";
      }
    } catch {
      return undefined;
    }

    return undefined;
  };

  const findTrainNumber = (link) => {
    const candidates = [
      link.dataset.trainNumber,
      new URLSearchParams(window.location.search).get("train"),
      window.location.pathname.match(/\/train\/(\d{5})\/?$/)?.[1],
      (link.getAttribute("href") || "").match(/[?&]train=(\d{5})/)?.[1],
    ];

    return candidates.find((value) => TRAIN_NUMBER_PATTERN.test(value || ""));
  };

  const findLocation = (link) => {
    if (link.dataset.gaLocation) return link.dataset.gaLocation;
    if (link.closest(".hero, .hero-content")) return "hero";
    if (link.closest(".cta")) return "page_cta";
    if (link.closest(".quick")) return "immediate_help";
    if (link.closest("#results")) return "train_search_results";
    if (link.closest(".actions")) return "app_link_actions";
    return "page_content";
  };

  document.addEventListener("click", (event) => {
    const origin = event.target;
    if (!(origin instanceof Element)) return;

    const link = origin.closest("a");
    if (!link) return;

    const eventName = classifyLink(link);
    if (!eventName) return;

    const trainNumber = findTrainNumber(link);
    const parameters = {
      cta_location: findLocation(link),
      link_url: link.href,
      link_text: (link.textContent || "").trim().slice(0, 100),
      page_path: window.location.pathname,
      train_number: trainNumber,
    };

    if (eventName === "select_content") {
      parameters.content_type = link.dataset.gaContentType || "train";
      parameters.content_id =
        link.dataset.gaContentId ||
        (trainNumber ? `train_${trainNumber}` : undefined);
    }

    window.rhTrack(eventName, parameters);
  });
})();
