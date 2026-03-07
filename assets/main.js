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

  function normalizeUrl(value) {
    if (typeof value !== "string") {
      return "";
    }

    const trimmed = value.trim();
    if (trimmed === "") {
      return "";
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    return `https://${trimmed}`;
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

  function parseSemester(value) {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    if (normalized === "") {
      return null;
    }

    const rankByTerm = {
      winter: 0,
      spring: 1,
      summer: 2,
      fall: 3,
      autumn: 3,
    };

    const termYearMatch = normalized.match(
      /^(spring|summer|fall|autumn|winter)\s+(\d{4})$/i,
    );
    const yearTermMatch = normalized.match(
      /^(\d{4})\s+(spring|summer|fall|autumn|winter)$/i,
    );

    let year;
    let term;

    if (termYearMatch) {
      term = termYearMatch[1].toLowerCase();
      year = Number.parseInt(termYearMatch[2], 10);
    } else if (yearTermMatch) {
      year = Number.parseInt(yearTermMatch[1], 10);
      term = yearTermMatch[2].toLowerCase();
    } else {
      return null;
    }

    const termRank = rankByTerm[term];
    if (typeof termRank !== "number" || Number.isNaN(year)) {
      return null;
    }

    return { year, termRank };
  }

  function validateSemesters(talks) {
    talks.forEach((talk, index) => {
      const semesterValue = talk?.semester;
      const parsed = parseSemester(semesterValue);
      if (parsed) {
        return;
      }

      const talkLabel =
        typeof talk?.title === "string" && talk.title.trim() !== ""
          ? talk.title.trim()
          : `Talk #${index + 1}`;

      console.warn(
        `[AI Seminar] Invalid or missing semester for "${talkLabel}". ` +
          'Use "Fall 2026" or "2026 Fall" format.',
      );
    });
  }

  function isSemesterMoreRecent(a, b) {
    if (a.year !== b.year) {
      return a.year > b.year;
    }
    return a.termRank > b.termRank;
  }

  function getMostRecentDateValue(talks) {
    return talks.reduce((maxValue, talk) => {
      const talkDate = toDate(talk.date);
      if (!talkDate) {
        return maxValue;
      }
      return Math.max(maxValue, talkDate.getTime());
    }, Number.NEGATIVE_INFINITY);
  }

  function compareSemesterGroupsByRecency(a, b) {
    if (a.parsedSemester && b.parsedSemester) {
      if (isSemesterMoreRecent(a.parsedSemester, b.parsedSemester)) {
        return -1;
      }
      if (isSemesterMoreRecent(b.parsedSemester, a.parsedSemester)) {
        return 1;
      }
    } else if (a.parsedSemester && !b.parsedSemester) {
      return -1;
    } else if (!a.parsedSemester && b.parsedSemester) {
      return 1;
    }

    const dateA = getMostRecentDateValue(a.talks);
    const dateB = getMostRecentDateValue(b.talks);
    if (dateA !== dateB) {
      return dateB - dateA;
    }

    return a.label.localeCompare(b.label);
  }

  function getSemesterGroups(talks) {
    const sorted = sortByDateAsc(talks);
    const groupsMap = new Map();

    sorted.forEach((talk) => {
      const semesterLabel =
        typeof talk.semester === "string" && talk.semester.trim() !== ""
          ? talk.semester.trim()
          : "Unspecified";

      if (!groupsMap.has(semesterLabel)) {
        groupsMap.set(semesterLabel, {
          label: semesterLabel,
          parsedSemester: parseSemester(semesterLabel),
          talks: [],
        });
      }

      groupsMap.get(semesterLabel).talks.push(talk);
    });

    return Array.from(groupsMap.values()).sort(compareSemesterGroupsByRecency);
  }

  function getMostRecentSemesterGroup(groups) {
    return groups.length > 0 ? groups[0] : null;
  }

  function renderSemesterDropdown(groups, defaultLabel) {
    const select = document.querySelector("#schedule-semester-select");
    if (!select) {
      return null;
    }

    if (groups.length === 0) {
      select.innerHTML = "";
      select.disabled = true;
      return select;
    }

    select.disabled = false;
    select.innerHTML = groups
      .map(
        (group) =>
          `<option value="${escapeHtml(group.label)}">${escapeHtml(group.label)}</option>`,
      )
      .join("");

    select.value = defaultLabel;
    return select;
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

  function renderScheduleCards(semesterTalks) {
    const container = document.querySelector("#schedule-cards");
    if (!container) {
      return;
    }

    if (semesterTalks.length === 0) {
      container.innerHTML =
        '<p class="empty-state">Schedule updates are coming soon.</p>';
      return;
    }

    const items = semesterTalks.map((talk) => {
      const dateLabel = shortDate(talk.date);
      const format = escapeHtml(talk.format || "Talk");
      const title = escapeHtml(talk.title || "Untitled talk");
      const summary = escapeHtml(talk.summary || "Details coming soon.");
      const speaker = escapeHtml(talk.speaker || "TBA");
      const time = escapeHtml(talk.time || "TBD");
      const location = escapeHtml(talk.location || "TBD");
      const slidesUrl = normalizeUrl(
        typeof talk.slides === "string" ? talk.slides : "",
      );
      const slidesHtml =
        slidesUrl !== ""
          ? `      <p><a class="slides-link" href="${escapeHtml(slidesUrl)}" target="_blank" rel="noopener noreferrer">Slides</a></p>`
          : "";

      const briefLine = `${dateLabel} | ${title} | ${speaker}`;

      return [
        '<li class="schedule-list-item">',
        '  <details class="schedule-item">',
        `    <summary class=\"schedule-item-summary\">${briefLine}</summary>`,
        '    <div class="schedule-item-content">',
        `      <p class=\"meta-label\">${format}</p>`,
        `      <p><strong>Time:</strong> ${time} <strong>Location:</strong> ${location}</p>`,
        `      <p>${summary}</p>`,
        slidesHtml,
        "    </div>",
        "  </details>",
        "</li>",
      ].join("\n");
    });

    container.innerHTML = `<ul class="schedule-list">${items.join("\n")}</ul>`;
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
    validateSemesters(allTalks);
    const upcomingTalks = getUpcomingTalks(allTalks);
    const semesterGroups = getSemesterGroups(allTalks);
    const mostRecentSemesterGroup = getMostRecentSemesterGroup(semesterGroups);
    const defaultSemesterLabel = mostRecentSemesterGroup
      ? mostRecentSemesterGroup.label
      : "";
    const semesterSelect = renderSemesterDropdown(
      semesterGroups,
      defaultSemesterLabel,
    );

    if (semesterSelect && semesterGroups.length > 0) {
      semesterSelect.addEventListener("change", () => {
        const selectedGroup = semesterGroups.find(
          (group) => group.label === semesterSelect.value,
        );
        renderScheduleCards(selectedGroup ? selectedGroup.talks : []);
      });
    }

    renderUpcomingEvents(upcomingTalks);
    renderScheduleCards(
      mostRecentSemesterGroup ? mostRecentSemesterGroup.talks : [],
    );
    renderFeaturedSpeakers(allTalks);
    activateRevealAnimation();
  }

  init();
})();
