const dayMs = 24 * 60 * 60 * 1000;
const chartStart = new Date("2026-01-01T00:00:00");
const chartEnd = new Date("2027-12-31T00:00:00");
const dayWidth = 3;
const totalChartDays = Math.round((chartEnd - chartStart) / dayMs) + 1;

const fallbackProjects = [
  {
    id: "proj-1",
    workstream: "TRU",
    name: "Huddersfield accommodation",
    owner: "OR",
    start: "2026-11-23",
    finish: "2027-01-31",
    ongoing: false,
    status: "Huddersfield accommodation risk",
    scope: "Lead Operational Readiness and coordination of planning for TRU blockades & change",
    outcomes: "NTL's operational readiness and other interests represented at local level TRU planning",
    achievements: "Interim solution for Huddersfield traincrew accommodation during blockades",
    nextFocus: "Long term solution for Huddersfield traincrew accommodation and OM change block arrangement",
    updates: [
      { date: "2026-12-25", type: "RAG", text: "25 Dec-31 Jan accommodation risk" },
      { date: "2026-12-31", type: "Agreed", text: "Agreed 1" }
    ]
  }
];

const defaultWorkstreams = [
  "Timetable / Service Change",
  "Events & Engineering*",
  "TRU",
  "Infrastructure Change",
  "Training",
  "Linking / Traincrew Knowledge",
  "Other Activity"
];

let projects = loadProjects();
let workstreams = loadWorkstreams();
let editingId = null;
let showMilestoneDescriptions = loadMilestoneDescriptionSetting();
let activeOwner = loadOwnerFilter();

const ganttChart = document.querySelector("#ganttChart");
const summaryCards = document.querySelector("#summaryCards");
const projectRows = document.querySelector("#projectRows");
const workstreamsList = document.querySelector("#workstreamsList");
const modal = document.querySelector("#projectModal");
const milestoneToggle = document.querySelector("#milestoneDescriptionToggle");
const ownerFilter = document.querySelector("#ownerFilter");
const summaryOwnerFilter = document.querySelector("#summaryOwnerFilter");
const loadButton = document.querySelector("#databaseLoadBtn");
const saveButton = document.querySelector("#databaseSaveBtn");
const saveStatus = document.querySelector("#saveStatus");
const exportSummaryButton = document.querySelector("#exportSummaryBtn");
const summaryExportStatus = document.querySelector("#summaryExportStatus");

milestoneToggle.checked = showMilestoneDescriptions;
milestoneToggle.addEventListener("change", () => {
  showMilestoneDescriptions = milestoneToggle.checked;
  localStorage.setItem("or-gantt-show-milestone-descriptions", JSON.stringify(showMilestoneDescriptions));
  renderGantt();
});

loadButton.addEventListener("click", loadDatabase);
saveButton.addEventListener("click", saveDatabase);
exportSummaryButton.addEventListener("click", exportSummaryJpg);
document.querySelector("#addWorkstreamBtn").addEventListener("click", addWorkstream);
ownerFilter.addEventListener("change", () => {
  setActiveOwner(ownerFilter.value);
});
summaryOwnerFilter.addEventListener("change", () => {
  setActiveOwner(summaryOwnerFilter.value);
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.view}View`).classList.add("active");
  });
});

document.querySelector("#addProjectBtn").addEventListener("click", () => {
  const id = `proj-${Date.now()}`;
  projects.push({
    id,
    workstream: workstreams.includes("Training") ? "Training" : workstreams[0] || "Other Activity",
    name: "New readiness project",
    owner: "",
    start: "2026-04-01",
    finish: "2026-06-30",
    ongoing: false,
    status: "On Target / No Concerns",
    scope: "Lead Operational Readiness and coordination",
    outcomes: "Managed delivery with minimal risk",
    achievements: "",
    nextFocus: "",
    updates: []
  });
  saveProjects();
  openProject(id);
});

document.querySelector("#addUpdateBtn").addEventListener("click", () => {
  addUpdateRow({ date: isoTodayIn2026(), type: "Agreed", text: "Agreed 1" });
});

document.querySelector("#saveProjectBtn").addEventListener("click", saveModal);
document.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
document.querySelector("#ownerInput").addEventListener("input", (event) => {
  event.target.value = normalizeOwner(event.target.value);
});

renderAll();

function loadProjects() {
  try {
    const saved = localStorage.getItem("or-gantt-projects");
    return saved ? JSON.parse(saved) : fallbackProjects;
  } catch {
    return fallbackProjects;
  }
}

function saveProjects() {
  localStorage.setItem("or-gantt-projects", JSON.stringify(projects));
}

function loadWorkstreams() {
  try {
    const saved = localStorage.getItem("or-gantt-workstreams");
    return saved ? JSON.parse(saved) : deriveWorkstreams(projects);
  } catch {
    return deriveWorkstreams(projects);
  }
}

function saveWorkstreams() {
  localStorage.setItem("or-gantt-workstreams", JSON.stringify(workstreams));
}

function loadMilestoneDescriptionSetting() {
  const saved = localStorage.getItem("or-gantt-show-milestone-descriptions");
  return saved === null ? true : JSON.parse(saved);
}

function loadOwnerFilter() {
  return localStorage.getItem("or-gantt-owner-filter") || "all";
}

function renderAll() {
  renderOwnerFilter();
  renderGantt();
  renderSummary();
  renderProjectTable();
  renderWorkstreams();
}

function renderOwnerFilter() {
  const owners = ownerList();
  if (activeOwner !== "all" && !owners.includes(activeOwner)) {
    activeOwner = "all";
    localStorage.setItem("or-gantt-owner-filter", activeOwner);
  }
  const options = [
    `<option value="all">All owners</option>`,
    ...owners.map((owner) => `<option value="${escapeAttr(owner)}">${escapeHtml(owner)}</option>`)
  ].join("");
  ownerFilter.innerHTML = options;
  summaryOwnerFilter.innerHTML = options;
  ownerFilter.value = activeOwner;
  summaryOwnerFilter.value = activeOwner;
}

function setActiveOwner(owner) {
  activeOwner = owner;
  localStorage.setItem("or-gantt-owner-filter", activeOwner);
  renderOwnerFilter();
  renderGantt();
  renderSummary();
}

function renderGantt() {
  ganttChart.innerHTML = "";
  ganttChart.classList.toggle("hide-milestone-labels", !showMilestoneDescriptions);
  const grid = document.createElement("div");
  grid.className = "gantt-grid";

  const leftSpacer = document.createElement("div");
  leftSpacer.className = "left-spacer";
  grid.appendChild(leftSpacer);

  const yearBand = document.createElement("div");
  yearBand.className = "year-band";
  yearBand.textContent = "2026 - 2027";
  grid.appendChild(yearBand);

  monthSpans().forEach((month) => {
    const el = document.createElement("div");
    el.className = "month";
    el.style.gridColumn = `${2 + month.startDay} / ${2 + month.endDay}`;
    el.textContent = month.label;
    grid.appendChild(el);
  });

  const today = document.createElement("div");
  today.className = "today-line";
  today.style.left = `${225 + offsetForDate(new Date("2026-05-01"))}px`;
  grid.appendChild(today);

  let gridRow = 3;
  workstreams.forEach((category) => {
    const items = visibleProjectsForWorkstream(category);
    const rowHeight = Math.max(66, 20 + items.length * 20);
    const label = document.createElement("div");
    label.className = "row-label";
    label.style.gridRow = gridRow;
    label.style.height = `${rowHeight}px`;
    label.textContent = category;
    grid.appendChild(label);

    const lane = document.createElement("div");
    lane.className = "lane";
    lane.style.gridColumn = "2 / -1";
    lane.style.gridRow = gridRow;
    lane.style.height = `${rowHeight}px`;
    grid.appendChild(lane);

    items.forEach((project, projectIndex) => {
      drawProject(lane, project, projectIndex);
    });
    gridRow += 1;
  });

  ganttChart.appendChild(grid);
}

function drawProject(lane, project, projectIndex) {
  const top = 10 + projectIndex * 18;
  const left = offsetForDate(new Date(project.start));
  const endDate = project.ongoing ? chartEnd : new Date(project.finish || "2027-12-31");
  const width = Math.max(28, offsetForDate(endDate) - left);
  const bar = document.createElement("button");
  bar.className = "bar";
  bar.style.left = `${left}px`;
  bar.style.top = `${top}px`;
  bar.style.width = `${width}px`;
  bar.textContent = project.name;
  bar.title = "Click to update project";
  bar.addEventListener("click", () => openProject(project.id));
  lane.appendChild(bar);

  (project.updates || []).forEach((update) => {
    const x = offsetForDate(new Date(update.date));
    if (x < 0 || x > totalChartDays * dayWidth) return;

    if (update.type === "Slipped") {
      const line = document.createElement("div");
      line.className = "slipped-line";
      line.style.left = `${Math.max(left, x - 90)}px`;
      line.style.top = `${top + 7}px`;
      line.style.width = `${Math.max(60, x - Math.max(left, x - 90))}px`;
      lane.appendChild(line);
    }

    const marker = document.createElement("span");
    marker.className = `milestone ${milestoneClass(update.type)}`;
    marker.style.left = `${x}px`;
    marker.style.top = `${top + 7}px`;
    marker.title = `${update.type}: ${update.text}`;
    lane.appendChild(marker);

    const label = document.createElement("span");
    label.className = "milestone-label";
    label.style.left = `${x + 8}px`;
    label.style.top = `${top + 6}px`;
    label.textContent = update.text;
    label.title = `${update.type}: ${update.text}`;
    lane.appendChild(label);
  });
}

function visibleProjectsForWorkstream(category) {
  return projects.filter((project) => {
    const matchesWorkstream = normalizeWorkstream(project.workstream) === normalizeWorkstream(category);
    const matchesOwner = activeOwner === "all" || normalizeOwner(project.owner) === normalizeOwner(activeOwner);
    return matchesWorkstream && matchesOwner;
  });
}

async function saveDatabase() {
  setStatus("Saving...");
  const database = {
    savedAt: new Date().toISOString(),
    settings: {
      showMilestoneDescriptions
    },
    workstreams,
    projects
  };

  try {
    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(database, null, 2)
    });
    if (!response.ok) throw new Error("Save endpoint unavailable");
    setStatus("Saved");
  } catch {
    downloadDatabase(database);
    setStatus("Downloaded");
  }
}

function downloadDatabase(database) {
  const blob = new Blob([JSON.stringify(database, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "database.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function exportSummaryJpg() {
  setExportStatus("Exporting...");
  try {
    await exportSummaryFromCanvas();
    setExportStatus("Exported");
  } catch (error) {
    console.error(error);
    setExportStatus("Export failed");
  }
}

async function exportSummaryFromCanvas() {
  const scale = 2;
  const layout = buildSummaryExportLayout();
  const canvas = document.createElement("canvas");
  canvas.width = layout.width * scale;
  canvas.height = layout.height * scale;
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  drawSummaryExport(context, layout);
  await downloadCanvasBlob(canvas);
}

async function downloadCanvasBlob(canvas) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
  if (!blob) throw new Error("Export failed");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `summary-report-${new Date().toISOString().slice(0, 10)}.jpg`;
  link.click();
  URL.revokeObjectURL(url);
}

function setExportStatus(message) {
  summaryExportStatus.textContent = message;
  if (message) {
    window.clearTimeout(setExportStatus.timer);
    setExportStatus.timer = window.setTimeout(() => {
      summaryExportStatus.textContent = "";
    }, 2500);
  }
}

function buildSummaryExportLayout() {
  const cardWidth = 560;
  const gapX = 20;
  const gapY = 12;
  const margin = 28;
  const top = 104;
  const categories = workstreams.filter((category) => category !== "Other Activity");
  const cards = categories.map((category) => {
    const workstreamProjects = visibleProjectsForWorkstream(category);
    const status = summaryStatus(workstreamProjects);
    const scope = workstreamProjects.length ? uniqueText(workstreamProjects.map((project) => project.scope)).join("; ") : "Add a project in the Projects tab.";
    const outcomes = workstreamProjects.length ? uniqueText(workstreamProjects.map((project) => project.outcomes)).join("; ") : "";
    const achievements = workstreamProjects.length ? summaryLines(workstreamProjects, "achievements") : "";
    const nextFocus = workstreamProjects.length ? summaryLines(workstreamProjects, "nextFocus") : "";
    const dynamicHeight = Math.max(
      190,
      118 + estimateTextHeight(scope, 72, 12, 14) + estimateTextHeight(outcomes, 72, 12, 14) + Math.max(estimateTextHeight(achievements, 34, 12, 14), estimateTextHeight(nextFocus, 34, 12, 14))
    );
    return { category, status, scope, outcomes, achievements, nextFocus, height: dynamicHeight };
  });

  const rowHeights = [];
  for (let i = 0; i < cards.length; i += 2) {
    rowHeights.push(Math.max(cards[i]?.height || 0, cards[i + 1]?.height || 0));
  }
  const height = top + rowHeights.reduce((sum, value) => sum + value, 0) + Math.max(0, rowHeights.length - 1) * gapY + margin;
  return { width: 1220, height, margin, top, cardWidth, gapX, gapY, cards, rowHeights };
}

function drawSummaryExport(ctx, layout) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = "#28235f";
  ctx.font = "italic 700 28px Arial";
  const mainTitle = "Operational Readiness";
  ctx.fillText(mainTitle, layout.margin, 45);
  const mainTitleWidth = ctx.measureText(mainTitle).width;
  ctx.font = "italic 700 18px Arial";
  ctx.fillText("Priority Workstreams Report", layout.margin + mainTitleWidth + 16, 45);
  drawExportLegend(ctx, layout.width - 520, 28);

  let y = layout.top;
  for (let row = 0; row < layout.rowHeights.length; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      const index = row * 2 + col;
      const card = layout.cards[index];
      if (!card) continue;
      const x = layout.margin + col * (layout.cardWidth + layout.gapX);
      drawSummaryCard(ctx, x, y, layout.cardWidth, layout.rowHeights[row], card);
    }
    y += layout.rowHeights[row] + layout.gapY;
  }
}

function drawExportLegend(ctx, x, y) {
  const items = [
    ["#ff1010", "Immediate attention needed"],
    ["#ffc20a", "Medium concern, monitor closely"],
    ["#8dd14f", "On track"]
  ];
  ctx.font = "12px Arial";
  let cursor = x;
  items.forEach(([color, label]) => {
    ctx.fillStyle = color;
    ctx.fillRect(cursor, y, 17, 17);
    ctx.strokeStyle = "#28235f";
    ctx.strokeRect(cursor, y, 17, 17);
    ctx.fillStyle = "#151245";
    ctx.fillText(label, cursor + 23, y + 13);
    cursor += label.length * 6.2 + 42;
  });
}

function drawSummaryCard(ctx, x, y, width, height, card) {
  const navy = "#28235f";
  const lavender = "#8a82cf";
  const grey = "#d4d4da";
  const paper = "#f4f4f6";
  ctx.strokeStyle = navy;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = navy;
  ctx.fillRect(x, y, width / 2, 28);
  ctx.fillStyle = statusFill(card.status);
  ctx.fillRect(x + width / 2, y, width / 2, 28);
  ctx.strokeRect(x, y, width, 28);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 13px Arial";
  ctx.fillText(card.category, x + 8, y + 19);
  ctx.fillStyle = statusClass(card.status) === "urgent" ? "#ffffff" : "#000000";
  drawCenteredWrappedText(ctx, `Status: ${card.status}`, x + width / 2 + 8, y, width / 2 - 16, 28, 13, 14, 1);

  const scopeHeight = Math.max(34, estimateTextHeight(`Scope: ${card.scope}`, 78, 12, 14));
  const outcomesHeight = Math.max(34, estimateTextHeight(`Outcomes: ${card.outcomes}`, 78, 12, 14));
  let cursorY = y + 28;
  drawTextBand(ctx, x, cursorY, width, scopeHeight, grey, `Scope: ${card.scope}`);
  cursorY += scopeHeight;
  drawTextBand(ctx, x, cursorY, width, outcomesHeight, paper, `Outcomes: ${card.outcomes}`);
  cursorY += outcomesHeight;

  ctx.fillStyle = lavender;
  ctx.fillRect(x, cursorY, width, 24);
  ctx.strokeStyle = navy;
  ctx.strokeRect(x, cursorY, width / 2, 24);
  ctx.strokeRect(x + width / 2, cursorY, width / 2, 24);
  ctx.fillStyle = navy;
  ctx.font = "700 12px Arial";
  ctx.fillText("Achievements:", x + 8, cursorY + 16);
  ctx.fillText("Next focus:", x + width / 2 + 8, cursorY + 16);
  cursorY += 24;

  ctx.fillStyle = paper;
  ctx.fillRect(x, cursorY, width, height - (cursorY - y));
  ctx.strokeStyle = navy;
  ctx.strokeRect(x, cursorY, width / 2, height - (cursorY - y));
  ctx.strokeRect(x + width / 2, cursorY, width / 2, height - (cursorY - y));
  ctx.fillStyle = "#151245";
  ctx.font = "12px Arial";
  drawWrappedText(ctx, card.achievements, x + 8, cursorY + 14, width / 2 - 16, 12, 14);
  drawWrappedText(ctx, card.nextFocus, x + width / 2 + 8, cursorY + 14, width / 2 - 16, 12, 14);
}

function drawTextBand(ctx, x, y, width, height, fill, text) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#28235f";
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#151245";
  ctx.font = "12px Arial";
  drawWrappedText(ctx, text, x + 8, y + 15, width - 16, 12, 14);
}

function drawWrappedText(ctx, text, x, y, maxWidth, fontSize, lineHeight, maxLines = Infinity) {
  const lines = wrapCanvasText(ctx, text, maxWidth);
  lines.slice(0, maxLines).forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

function drawCenteredWrappedText(ctx, text, x, y, maxWidth, boxHeight, fontSize, lineHeight, maxLines = Infinity) {
  const lines = wrapCanvasText(ctx, text, maxWidth).slice(0, maxLines);
  const blockHeight = lines.length * lineHeight;
  const firstBaseline = y + (boxHeight - blockHeight) / 2 + fontSize;
  lines.forEach((line, index) => {
    ctx.fillText(line, x, firstBaseline + index * lineHeight);
  });
}

function wrapCanvasText(ctx, text, maxWidth) {
  const sourceLines = String(text || "").split("\n");
  const lines = [];
  sourceLines.forEach((sourceLine) => {
    const words = sourceLine.split(/\s+/).filter(Boolean);
    let line = "";
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
  });
  return lines;
}

function estimateTextHeight(text, charsPerLine, fontSize, lineHeight) {
  const lines = String(text || "").split("\n").reduce((count, line) => count + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return Math.max(lineHeight + 8, lines * lineHeight + 12);
}

function statusFill(status) {
  const clean = statusClass(status);
  if (clean === "urgent") return "#ff1010";
  if (clean === "risk") return "#ffc20a";
  return "#8dd14f";
}

function renderSummary() {
  summaryCards.innerHTML = "";
  const summaryCategories = workstreams.filter((category) => category !== "Other Activity");
  summaryCategories.forEach((category) => {
    const workstreamProjects = visibleProjectsForWorkstream(category);
    const status = summaryStatus(workstreamProjects);
    const scope = workstreamProjects.length
      ? uniqueText(workstreamProjects.map((project) => project.scope)).join("; ")
      : "Add a project in the Projects tab.";
    const outcomes = workstreamProjects.length
      ? uniqueText(workstreamProjects.map((project) => project.outcomes)).join("; ")
      : "";
    const achievements = workstreamProjects.length
      ? summaryLines(workstreamProjects, "achievements")
      : "";
    const nextFocus = workstreamProjects.length
      ? summaryLines(workstreamProjects, "nextFocus")
      : "";
    const card = document.createElement("article");
    card.className = "summary-card";
    if (!workstreamProjects.length) {
      card.innerHTML = `
        <div class="summary-card-head">
          <div>${escapeHtml(category)}</div>
          <div class="status ok">Status: No active project</div>
        </div>
        <div class="summary-row"><strong>Scope:</strong> Add a project in the Projects tab.</div>
        <div class="summary-row"><strong>Outcomes:</strong></div>
        <div class="summary-bottom-head"><div>Achievements:</div><div>Next focus:</div></div>
        <div class="summary-bottom"><div></div><div></div></div>
      `;
    } else {
      card.innerHTML = `
        <div class="summary-card-head">
          <div>${escapeHtml(category)}</div>
          <div class="status ${statusClass(status)}">Status: ${escapeHtml(status)}</div>
        </div>
        <div class="summary-row"><strong>Scope:</strong> ${escapeHtml(scope)}</div>
        <div class="summary-row"><strong>Outcomes:</strong> ${escapeHtml(outcomes)}</div>
        <div class="summary-bottom-head"><div>Achievements:</div><div>Next focus:</div></div>
        <div class="summary-bottom">
          <div>${formatMultiline(achievements)}</div>
          <div>${formatMultiline(nextFocus)}</div>
        </div>
      `;
    }
    summaryCards.appendChild(card);
  });
}

function renderProjectTable() {
  projectRows.innerHTML = "";
  projects.forEach((project) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(project.workstream)}</td>
      <td>${escapeHtml(project.name)}</td>
      <td>${escapeHtml(project.owner || "")}</td>
      <td>${formatDate(project.start)}</td>
      <td>${project.ongoing ? "Ongoing" : formatDate(project.finish)}</td>
      <td>${escapeHtml(project.status)}</td>
      <td>${(project.updates || []).length}</td>
    `;
    row.addEventListener("click", () => openProject(project.id));
    projectRows.appendChild(row);
  });
}

function renderWorkstreams() {
  workstreamsList.innerHTML = "";
  workstreams.forEach((workstream, index) => {
    const usage = projects.filter((project) => normalizeWorkstream(project.workstream) === normalizeWorkstream(workstream)).length;
    const row = document.createElement("div");
    row.className = "workstream-row";
    row.innerHTML = `
      <input type="text" value="${escapeAttr(workstream)}" aria-label="Workstream name" />
      <span class="usage-pill">${usage} projects</span>
      <button class="danger-btn" ${usage ? "disabled" : ""}>Delete</button>
    `;
    const input = row.querySelector("input");
    input.addEventListener("change", () => renameWorkstream(index, input.value));
    input.addEventListener("blur", () => renameWorkstream(index, input.value));
    row.querySelector("button").addEventListener("click", () => deleteWorkstream(index));
    workstreamsList.appendChild(row);
  });
}

function addWorkstream() {
  const base = "New Workstream";
  let name = base;
  let count = 2;
  while (workstreams.some((item) => normalizeWorkstream(item) === normalizeWorkstream(name))) {
    name = `${base} ${count}`;
    count += 1;
  }
  workstreams.push(name);
  saveWorkstreams();
  renderAll();
}

function renameWorkstream(index, value) {
  const oldName = workstreams[index];
  const newName = value.trim();
  if (!newName || newName === oldName) {
    renderWorkstreams();
    return;
  }
  const duplicate = workstreams.some((item, itemIndex) => itemIndex !== index && normalizeWorkstream(item) === normalizeWorkstream(newName));
  if (duplicate) {
    setStatus("Name exists");
    renderWorkstreams();
    return;
  }
  workstreams[index] = newName;
  projects.forEach((project) => {
    if (normalizeWorkstream(project.workstream) === normalizeWorkstream(oldName)) {
      project.workstream = newName;
    }
  });
  saveWorkstreams();
  saveProjects();
  renderAll();
}

function deleteWorkstream(index) {
  const name = workstreams[index];
  const usage = projects.filter((project) => normalizeWorkstream(project.workstream) === normalizeWorkstream(name)).length;
  if (usage) {
    setStatus("In use");
    return;
  }
  workstreams.splice(index, 1);
  saveWorkstreams();
  renderAll();
}

function openProject(id) {
  const project = projects.find((item) => item.id === id);
  if (!project) return;
  editingId = id;
  document.querySelector("#modalTitle").textContent = project.name;
  document.querySelector("#modalSubtitle").textContent = "Updates saved here become milestones on the Gantt chart.";
  document.querySelector("#projectNameInput").value = project.name;
  renderWorkstreamOptions(project.workstream);
  document.querySelector("#ownerInput").value = project.owner || "";
  document.querySelector("#startInput").value = project.start;
  document.querySelector("#finishInput").value = project.finish || "";
  document.querySelector("#ongoingInput").checked = Boolean(project.ongoing);
  document.querySelector("#statusInput").value = project.status;
  document.querySelector("#achievementInput").value = project.achievements || latestUpdateText(project) || "";
  document.querySelector("#nextFocusInput").value = project.nextFocus || "";
  document.querySelector("#updatesList").innerHTML = "";
  (project.updates || []).forEach(addUpdateRow);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function addUpdateRow(update) {
  const row = document.createElement("div");
  row.className = "update-row";
  row.innerHTML = `
    <input type="date" class="update-date" value="${escapeAttr(update.date || "")}" />
    <select class="update-type">
      ${["Agreed", "Met", "RAG", "Complete", "Slipped"].map((type) => `<option ${type === update.type ? "selected" : ""}>${type}</option>`).join("")}
    </select>
    <textarea class="update-text" placeholder="e.g. Agreed 1, Met 2, accommodation risk">${escapeHtml(update.text || "")}</textarea>
    <button class="remove-update" aria-label="Remove update">×</button>
  `;
  row.querySelector(".remove-update").addEventListener("click", () => row.remove());
  document.querySelector("#updatesList").appendChild(row);
}

function saveModal() {
  const project = projects.find((item) => item.id === editingId);
  if (!project) return;
  project.name = document.querySelector("#projectNameInput").value.trim() || "Untitled project";
  project.workstream = document.querySelector("#workstreamInput").value || workstreams[0] || "Other Activity";
  project.owner = normalizeOwner(document.querySelector("#ownerInput").value);
  project.start = document.querySelector("#startInput").value || "2026-01-01";
  project.finish = document.querySelector("#finishInput").value || "";
  project.ongoing = document.querySelector("#ongoingInput").checked;
  project.status = document.querySelector("#statusInput").value;
  project.achievements = document.querySelector("#achievementInput").value.trim();
  project.nextFocus = document.querySelector("#nextFocusInput").value.trim();
  project.updates = Array.from(document.querySelectorAll(".update-row"))
    .map((row) => ({
      date: row.querySelector(".update-date").value,
      type: row.querySelector(".update-type").value,
      text: row.querySelector(".update-text").value.trim()
    }))
    .filter((update) => update.date && update.text);
  saveProjects();
  saveWorkstreams();
  closeModal();
  renderAll();
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function renderWorkstreamOptions(selected) {
  const select = document.querySelector("#workstreamInput");
  if (selected && !workstreams.some((item) => normalizeWorkstream(item) === normalizeWorkstream(selected))) {
    workstreams.push(selected);
    saveWorkstreams();
  }
  select.innerHTML = workstreams.map((workstream) => {
    const isSelected = normalizeWorkstream(workstream) === normalizeWorkstream(selected);
    return `<option value="${escapeAttr(workstream)}" ${isSelected ? "selected" : ""}>${escapeHtml(workstream)}</option>`;
  }).join("");
}

function monthSpans() {
  const labels = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const months = [];
  for (const year of [2026, 2027]) {
    labels.forEach((label, index) => {
      const start = new Date(year, index, 1);
      const end = new Date(year, index + 1, 1);
      months.push({
        label: `${label} ${String(year).slice(2)}`,
        startDay: Math.round((start - chartStart) / dayMs),
        endDay: Math.round((end - chartStart) / dayMs)
      });
    });
  }
  return months;
}

async function loadDatabase() {
  setStatus("Loading...");
  try {
    const response = await fetch(`/database.json?ts=${Date.now()}`);
    if (!response.ok) throw new Error("Database file not found");
    const database = await response.json();
    if (!Array.isArray(database.projects)) throw new Error("Database has no projects list");
    projects = database.projects;
    workstreams = Array.isArray(database.workstreams) ? database.workstreams : deriveWorkstreams(projects);
    showMilestoneDescriptions = database.settings?.showMilestoneDescriptions ?? showMilestoneDescriptions;
    milestoneToggle.checked = showMilestoneDescriptions;
    saveProjects();
    saveWorkstreams();
    localStorage.setItem("or-gantt-show-milestone-descriptions", JSON.stringify(showMilestoneDescriptions));
    renderAll();
    setStatus("Loaded");
  } catch {
    setStatus("Load failed");
  }
}

function setStatus(message) {
  saveStatus.textContent = message;
  if (message) {
    window.clearTimeout(setStatus.timer);
    setStatus.timer = window.setTimeout(() => {
      saveStatus.textContent = "";
    }, 2500);
  }
}


function offsetForDate(date) {
  const clamped = new Date(Math.min(Math.max(date, chartStart), chartEnd));
  return Math.round((clamped - chartStart) / dayMs) * dayWidth;
}

function normalizeWorkstream(value) {
  return String(value || "").replace("*", "").trim().toLowerCase();
}

function normalizeOwner(value) {
  return String(value || "").trim().toUpperCase().slice(0, 3);
}

function ownerList() {
  return [...new Set(projects.map((project) => normalizeOwner(project.owner)).filter(Boolean))].sort();
}

function deriveWorkstreams(projectList) {
  const names = [...defaultWorkstreams];
  projectList.forEach((project) => {
    if (project.workstream && !names.some((name) => normalizeWorkstream(name) === normalizeWorkstream(project.workstream))) {
      names.push(project.workstream);
    }
  });
  return names;
}

function milestoneClass(type) {
  const clean = String(type || "").toLowerCase();
  if (clean === "complete") return "complete";
  if (clean === "slipped") return "slipped";
  if (clean === "met") return "met";
  if (clean === "agreed") return "agreed";
  return "rag";
}

function statusClass(status) {
  const clean = String(status || "").toLowerCase();
  if (clean.includes("risk") || clean.includes("medium")) return "risk";
  if (clean.includes("immediate")) return "urgent";
  return "ok";
}

function summaryStatus(projectList) {
  if (projectList.some((project) => statusClass(project.status) === "urgent")) return "Immediate attention needed";
  const riskProject = projectList.find((project) => statusClass(project.status) === "risk");
  if (riskProject) return riskProject.status;
  if (projectList.length && projectList.every((project) => project.status === "Complete")) return "Complete";
  return projectList[0]?.status || "No active project";
}

function uniqueText(values) {
  const seen = new Set();
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function summaryLines(projectList, field) {
  return projectList
    .map((project) => {
      const value = String(project[field] || "").trim();
      return value ? `${project.name}: ${value}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function formatMultiline(value) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function latestUpdateText(project) {
  const updates = [...(project.updates || [])].filter((update) => update.date && update.text);
  updates.sort((a, b) => new Date(b.date) - new Date(a.date));
  return updates[0]?.text || "";
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function isoTodayIn2026() {
  return "2026-05-26";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
