(function () {
  "use strict";

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function toDate(value) {
    const parsed = new Date(value + "T00:00:00");
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function shortDate(value) {
    const dt = toDate(value);
    if (!dt) {
      return "TBD";
    }
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function sortByDateAsc(talks) {
    return [...talks].sort((a, b) => {
      const da = toDate(a.date);
      const db = toDate(b.date);
      if (!da && !db) {
        return 0;
      }
      if (!da) {
        return 1;
      }
      if (!db) {
        return -1;
      }
      return da.getTime() - db.getTime();
    });
  }

  function getUpcomingTalks(talks) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = talks.filter((talk) => {
      const talkDate = toDate(talk.date);
      return talkDate && talkDate >= today;
    });

    return upcoming.length > 0 ? sortByDateAsc(upcoming) : sortByDateAsc(talks);
  }

  function renderUpcomingEvents(upcomingTalks) {
    const container = document.querySelector("#upcoming-events");
    if (!container) {
      return;
    }

    if (upcomingTalks.length === 0) {
      container.innerHTML =
        '<p class="empty-state">New talks will be announced soon.</p>';
      return;
    }

    const items = upcomingTalks.slice(0, 3).map((talk) => {
      const dateLabel = shortDate(talk.date);
      const title = escapeHtml(talk.title || "Untitled talk");
      const speaker = escapeHtml(talk.speaker || "TBA");
      const time = escapeHtml(talk.time || "TBD");
      const location = escapeHtml(talk.location || "TBD");
      const meta = `${speaker} | ${time} | ${location}`;

      return [
        '<article class="event-item">',
        `  <div class="event-date">${dateLabel}</div>`,
        "  <div>",
        `    <p class="event-title">${title}</p>`,
        `    <p class="event-meta">${meta}</p>`,
        "  </div>",
        "</article>",
      ].join("\n");
    });

    container.innerHTML = items.join("\n");
  }

  function renderScheduleCards(upcomingTalks) {
    const container = document.querySelector("#schedule-cards");
    if (!container) {
      return;
    }

    if (upcomingTalks.length === 0) {
      container.innerHTML =
        '<p class="empty-state">Schedule updates are coming soon.</p>';
      return;
    }

    const cards = upcomingTalks.slice(0, 2).map((talk) => {
      const format = escapeHtml(talk.format || "Talk");
      const title = escapeHtml(talk.title || "Untitled talk");
      const summary = escapeHtml(talk.summary || "Details coming soon.");

      return [
        '<article class="schedule-card">',
        `  <span class="meta-label">${format}</span>`,
        `  <h3>${title}</h3>`,
        `  <p class="section-subtitle">${summary}</p>`,
        "</article>",
      ].join("\n");
    });

    container.innerHTML = cards.join("\n");
  }

  function renderFeaturedSpeakers(talks) {
    const container = document.querySelector("#featured-speakers");
    if (!container) {
      return;
    }

    const speakersByName = new Map();
    talks.forEach((talk) => {
      if (!talk.featuredSpeaker || !talk.speaker) {
        return;
      }
      if (!speakersByName.has(talk.speaker)) {
        speakersByName.set(talk.speaker, {
          name: talk.speaker,
          affiliation: talk.affiliation || "",
          bio: talk.bio || "",
        });
      }
    });

    const speakers = Array.from(speakersByName.values()).slice(0, 3);

    if (speakers.length === 0) {
      container.innerHTML =
        '<p class="empty-state">Featured speakers will be posted soon.</p>';
      return;
    }

    const cards = speakers.map((speaker) => {
      const name = escapeHtml(speaker.name);
      const affiliation = escapeHtml(
        speaker.affiliation || "Affiliation coming soon.",
      );
      const bio = escapeHtml(speaker.bio || "Bio coming soon.");

      return [
        '<article class="card speaker">',
        `  <h3>${name}</h3>`,
        `  <small>${affiliation}</small>`,
        `  <p>${bio}</p>`,
        "</article>",
      ].join("\n");
    });

    container.innerHTML = cards.join("\n");
  }

  function activateRevealAnimation() {
    const revealItems = document.querySelectorAll(".reveal");
    if (revealItems.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 },
    );

    revealItems.forEach((element) => observer.observe(element));
  }

  function init() {
    const allTalks = Array.isArray(window.SEMINAR_TALKS)
      ? window.SEMINAR_TALKS
      : [];
    const upcomingTalks = getUpcomingTalks(allTalks);

    renderUpcomingEvents(upcomingTalks);
    renderScheduleCards(upcomingTalks);
    renderFeaturedSpeakers(allTalks);
    activateRevealAnimation();
  }

  init();
})();
