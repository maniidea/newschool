const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwRKCTYddMALyLdSrik2dQXOg1GVuscLs8-8vnkD2LBJNuxGpqIKls2y8IoPEvfpCnQ/exec";

let currentUser = null;
let masterCurriculum = [];
let masterQuestions = [];
let masterUserScores = [];
let teacherStudentScores = [];
let principalDashboardData = { scores: [], teachers: [], students: [] };

let activeQuizList = [];
let currentQIndex = 0;
let userScore = 0;
let perQuestionTime = 20;
let timeRemaining = 0;
let timerInterval = null;
let autoNextTimeout = null;
let isAnswered = false;
let extractedAiBatch = [];
let globalStandaloneCsvList = [];

let examReviewRecord = [];
let wrongQuestionsVault = [];
let bonusRetakesRemaining = 0;

// Voice & Audio Configuration
let currentAssessmentMode = "text";
let recognitionInstance = null;
let currentUtterance = null;
let activeTestLanguage = "en"; // 'en' for English, 'ta' for Tamil

// Audio Sound FX
const soundCorrect = new Audio("https://actions.google.com/sounds/v1/cartoon/pop.ogg");
const soundWrong = new Audio("https://actions.google.com/sounds/v1/cartoon/clank_car_crash.ogg");

const GLOBAL_STANDARDS = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
  "UG-1st-Year", "UG-2nd-Year", "UG-Final-Year", "PG", "Diploma"
];

const GLOBAL_SUBJECTS = ["Science", "Maths", "Social Science", "English", "Hindi", "Tamil", "Botany", "Zoology", "Physics", "Chemistry"];

function normalizeStream(stream) {
  if (!stream) return "ncert";
  const s = stream.toString().toLowerCase().trim();
  if (s.includes("metric") || s.includes("state")) return "stateboard";
  return "ncert";
}

function getStreamLabel(stream) {
  const norm = normalizeStream(stream);
  return norm === "stateboard" ? "STATEBOARD (METRIC)" : "NCERT";
}

function initApp() {
  const savedUser = localStorage.getItem("hmsUser");
  if (savedUser) {
    try { currentUser = JSON.parse(savedUser); } catch(e) { currentUser = null; } 
  }

  populateAllDropdowns();
  updateAuthUI();
  loadPortalData();
  loadDailyWinners();
}

async function loadDailyWinners() {
  const container = document.getElementById("dailyWinnersContainer");
  const dateText = document.getElementById("dailyWinnersDateText");
  if (!container) return;

  try {
    const url = `${SCRIPT_URL}?action=getDailyPuzzleWinners&_t=${Date.now()}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data && data.success && Array.isArray(data.winners)) {
      if (dateText && data.date) {
        dateText.innerText = `தேதி: ${data.date} • அதிக மதிப்பெண் பெற்று விரைவாக முடித்த முதல் 3 வெற்றியாளர்கள்`;
      }
      renderDailyWinners(data.winners);
    } else {
      container.innerHTML = `<div style="font-size:0.85rem; color:#cbd5e1;">இன்றைய புதிரில் இன்னும் யாரும் பங்குபெறவில்லை. நீங்களே முதல் வெற்றியாளராகுங்கள்!</div>`;
    }
  } catch (err) {
    console.warn("Error loading daily winners:", err);
    container.innerHTML = `<div style="font-size:0.85rem; color:#cbd5e1;">புதிர் வெற்றியாளர் விவரங்களை ஏற்றுவதில் பிழை ஏற்பட்டது.</div>`;
  }
}

function renderDailyWinners(winners) {
  const container = document.getElementById("dailyWinnersContainer");
  if (!container) return;

  if (!winners || winners.length === 0) {
    container.innerHTML = `
      <div style="background: rgba(255,255,255,0.08); padding: 12px 18px; border-radius: 8px; width: 100%; font-size: 0.9rem; color: #cbd5e1;">
        🚀 இன்றைய தினசரி புதிரை இன்னும் யாரும் முடிக்கவில்லை. இப்போதே தேர்வை எழுதி முதல் வெற்றியாளராகுங்கள்!
      </div>
    `;
    return;
  }

  const medals = [
    { rank: "1-ஆம் இடம்", icon: "🥇", bg: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)" },
    { rank: "2-ஆம் இடம்", icon: "🥈", bg: "linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)" },
    { rank: "3-ஆம் இடம்", icon: "🥉", bg: "linear-gradient(135deg, #fdba74 0%, #c2410c 100%)" }
  ];

  container.innerHTML = winners.map((w, idx) => {
    const m = medals[idx] || medals[2];
    const timeDisplay = (w.timeTaken && w.timeTaken < 9000) ? `⏱️ ${w.timeTaken} வினாடிகள்` : "";
    const subjectName = w.subject || "General";

    return `
      <div style="flex: 1; min-width: 220px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 2rem; background: ${m.bg}; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
          ${m.icon}
        </div>
        <div style="overflow: hidden;">
          <div style="font-size: 0.75rem; font-weight: 700; color: #fde047; text-transform: uppercase;">${m.rank}</div>
          <div style="font-size: 0.95rem; font-weight: 700; color: #fff; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${w.userName}</div>
          <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 2px;">
            ${subjectName} • <strong>${w.score}/${w.total} (${w.percentage}%)</strong>
          </div>
          ${timeDisplay ? `<div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">${timeDisplay}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

function populateAllDropdowns() {
  const signupStd = document.getElementById("signupStd");
  if (signupStd) {
    signupStd.innerHTML = GLOBAL_STANDARDS.map(s => `<option value="${s}">${s}</option>`).join("");
  }

  const playStd = document.getElementById("playStdSelect");
  if (playStd) {
    let allowed = GLOBAL_STANDARDS;
    if (currentUser) {
      if (currentUser.role === "student") {
        allowed = (currentUser.standards && currentUser.standards.length > 0) ? currentUser.standards : ["1"];
      } else if (currentUser.role === "aspirant" || currentUser.role === "principal") {
        allowed = GLOBAL_STANDARDS;
      } else if (currentUser.role === "teacher") {
        allowed = (currentUser.standards && currentUser.standards.length > 0) ? currentUser.standards : GLOBAL_STANDARDS;
      }
    }
    playStd.innerHTML = allowed.map(s => `<option value="${s}">${s}</option>`).join("");
    syncPlaySubjects();
  }

  const authStd = document.getElementById("authorStdSelect");
  if (authStd) {
    let allowedStds = GLOBAL_STANDARDS;
    if (currentUser && currentUser.role === "teacher") {
      allowedStds = (currentUser.standards && currentUser.standards.length > 0) ? currentUser.standards : GLOBAL_STANDARDS;
    }
    authStd.innerHTML = allowedStds.map(s => `<option value="${s}">${s}</option>`).join("");
    syncAuthorSubjects();
  }

  const ncertStd = document.getElementById("ncertConfigStd");
  if (ncertStd) ncertStd.innerHTML = GLOBAL_STANDARDS.map(s => `<option value="${s}">வகுப்பு ${s}</option>`).join("");
  
  const ncertSub = document.getElementById("ncertConfigSub");
  if (ncertSub) ncertSub.innerHTML = GLOBAL_SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join("");

  const ncertViewStd = document.getElementById("ncertViewStdSelect");
  if (ncertViewStd) ncertViewStd.innerHTML = GLOBAL_STANDARDS.map(s => `<option value="${s}">வகுப்பு ${s}</option>`).join("");

  ["manageStdFilter", "repStdFilter", "tchRepStdFilter", "prFilterStd"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">All Standards</option>' + GLOBAL_STANDARDS.map(s => `<option value="${s}">${s}</option>`).join("");
  });

  const lbFilter = document.getElementById("leaderboardStdFilter");
  if (lbFilter) {
    lbFilter.innerHTML = '<option value="all">அனைத்து வகுப்புகள் (All Classes)</option>' + GLOBAL_STANDARDS.map(s => `<option value="${s}">வகுப்பு ${s}</option>`).join("");
  }

  ["manageSubFilter", "repSubFilter", "tchRepSubFilter", "prFilterSub"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">All Subjects</option>' + GLOBAL_SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join("");
  });
}

let globalLoaderSafetyTimer = null;

function setGlobalLoadingState(isLoading, title, subText, progressPct) {
  const overlay = document.getElementById("portalGlobalLoader");
  const titleEl = document.getElementById("loaderTitle");
  const subEl = document.getElementById("loaderSub");
  const fillEl = document.getElementById("loaderProgressBar");

  if (!overlay) return;

  if (isLoading) {
    overlay.style.display = "flex";
    overlay.classList.remove("fade-out");
    if (title && titleEl) titleEl.innerText = title;
    if (subText && subEl) subEl.innerText = subText;
    if (progressPct !== undefined && fillEl) fillEl.style.width = `${progressPct}%`;

    // Fail-safe: Always hide after 5 seconds regardless of network latency
    clearTimeout(globalLoaderSafetyTimer);
    globalLoaderSafetyTimer = setTimeout(() => {
      overlay.classList.add("fade-out");
      setTimeout(() => { overlay.style.display = "none"; }, 350);
    }, 5000);
  } else {
    clearTimeout(globalLoaderSafetyTimer);
    if (fillEl) fillEl.style.width = "100%";
    setTimeout(() => {
      overlay.classList.add("fade-out");
      setTimeout(() => { overlay.style.display = "none"; }, 350);
    }, 300);
  }
}

async function loadPortalData() {
  setGlobalLoadingState(true, "பள்ளித் தரவுகள் ஏற்றப்படுகின்றன...", "Google Sheet-ல் இருந்து வினா வங்கி பெறப்படுகிறது...", 35);

  try {
    const url = `${SCRIPT_URL}?action=getInitialData${currentUser ? '&userId=' + encodeURIComponent(currentUser.id) : ''}`;
    const res = await fetch(url);

    setGlobalLoadingState(true, "வினாக்கள் தயார் செய்யப்படுகின்றன...", "வகுப்புகள் மற்றும் பாடங்கள் கட்டமைக்கப்படுகின்றன...", 75);
    const data = await res.json();

    if (data && data.success) {
      if (data.curriculum) masterCurriculum = data.curriculum;     
      if (data.questions) masterQuestions = data.questions;     
      if (data.bookLinks) masterBookLinks = data.bookLinks;     
      if (data.user) {
        currentUser = data.user;     
        localStorage.setItem("hmsUser", JSON.stringify(currentUser));     
      }
    }
  } catch (err) {
    console.warn("Offline/Network Notice:", err);     
  } finally {
    try { populateAllDropdowns(); } catch (e) { console.warn(e); }     
    try { renderNcertBooksViewer(); } catch (e) { console.warn(e); }     
    try { if (typeof updateAiPromptPreview === "function") updateAiPromptPreview(); } catch (e) { console.warn(e); }     

    // Guarantees dismiss
    setGlobalLoadingState(false);
  }
}

function updateAuthUI() {
  const guestBanner = document.getElementById("guestBanner");
  const playCountInput = document.getElementById("playCountInput");
  const playAllCheckbox = document.getElementById("playAllCheckbox");
  const userBadge = document.getElementById("userBadge");
  const btnOpenLogin = document.getElementById("btnOpenLogin");
  const btnOpenSignup = document.getElementById("btnOpenSignup");
  const btnLogout = document.getElementById("btnLogout");
  const playScopeNotice = document.getElementById("playScopeNotice");
  const tabReplies = document.getElementById("tabMyReplies");

  if (currentUser) {
    if (guestBanner) guestBanner.classList.add("hidden");
    if (playCountInput) playCountInput.max = 100;
    if (playAllCheckbox) playAllCheckbox.disabled = false;

    if (btnOpenLogin) btnOpenLogin.classList.add("hidden");
    if (btnOpenSignup) btnOpenSignup.classList.add("hidden");
    if (btnLogout) btnLogout.classList.remove("hidden");
    
    const streamSelect = document.getElementById("playStreamSelect");
    if (streamSelect && currentUser.studentStream) {
      streamSelect.value = normalizeStream(currentUser.studentStream);
    }

    if (userBadge) {
      userBadge.classList.remove("hidden");
      let scope = `Class ${currentUser.standards.join(", ")} (${getStreamLabel(currentUser.studentStream)})`;
      if (currentUser.role === "principal") scope = "Master School Control";
      else if (currentUser.role === "aspirant") scope = "Aspirant Mode (Classes 5-12)";
      else if (currentUser.role === "teacher") scope = `Classes: [${currentUser.standards.join(",")}], Subs: [${currentUser.subjects.join(",")}]`;
      userBadge.innerText = `${currentUser.name} (${currentUser.role.toUpperCase()}) | ${scope}`;
    }

    if (playScopeNotice) {
      if (currentUser.role === "student") {
        playScopeNotice.innerText = `Attending Class ${currentUser.standards.join(", ")} Assessments (${getStreamLabel(currentUser.studentStream)}).`;
      } else {
        playScopeNotice.innerText = `Select Student Stream, Category, Standard, Subject, and Topic to begin.`;
      }
    }

    if (currentUser.role === "principal") {
      document.querySelectorAll(".principal-only").forEach(el => el.classList.remove("hidden"));
      document.querySelectorAll(".teacher-principal-only").forEach(el => el.classList.remove("hidden"));
    } else if (currentUser.role === "teacher") {
      document.querySelectorAll(".teacher-only").forEach(el => el.classList.remove("hidden"));
      document.querySelectorAll(".teacher-principal-only").forEach(el => el.classList.remove("hidden"));
    }
    
    const tabScores = document.getElementById("tabMyScores");
    if (tabScores) tabScores.classList.remove("hidden");

    if (tabReplies) {
      tabReplies.classList.toggle("hidden", currentUser.role !== "student");
    }
  } else {
    if (guestBanner) guestBanner.classList.remove("hidden");
    if (playCountInput) {
      playCountInput.value = Math.min(parseInt(playCountInput.value, 10) || 5, 10);
      playCountInput.max = 10;
    }
    if (playAllCheckbox) {
      playAllCheckbox.checked = false;
      playAllCheckbox.disabled = true;
    }

    if (btnOpenLogin) btnOpenLogin.classList.remove("hidden");
    if (btnOpenSignup) btnOpenSignup.classList.remove("hidden");
    if (btnLogout) btnLogout.classList.add("hidden");
    if (userBadge) userBadge.classList.add("hidden");
    if (tabReplies) tabReplies.classList.add("hidden");

    if (playScopeNotice) {
      playScopeNotice.innerText = `Select Student Stream, Category, Standard, Subject, and Topic to begin.`;
    }

    document.querySelectorAll(".teacher-principal-only, .teacher-only, .principal-only").forEach(el => el.classList.add("hidden"));
    const tabScores = document.getElementById("tabMyScores");
    if (tabScores) tabScores.classList.add("hidden");
  }

  populateAllDropdowns();
}

function toggleSignupCategory(val) {
  const stdGroup = document.getElementById("signupStdGroup");
  if (stdGroup) {
    if (val === "aspirant") {
      stdGroup.classList.add("hidden");
    } else {
      stdGroup.classList.remove("hidden");
    }
  }
}

function normalizeText(name) {
  if (!name) return "";
  return name.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function syncPlayStreamDropdowns() {
  syncPlaySubjects();
}

function syncPlaySubjects() {
  const playStd = document.getElementById("playStdSelect");
  const subSelect = document.getElementById("playSubSelect");
  const streamSelect = document.getElementById("playStreamSelect");
  if (!playStd || !subSelect) return;

  const std = playStd.value || "5";
  const selectedStream = normalizeStream(streamSelect ? streamSelect.value : "ncert");
  const subMap = new Map();

  masterQuestions
    .filter(q => q.standard === std && normalizeStream(q.stream) === selectedStream)
    .forEach(q => {
      if (q.subject) {
        const cleanName = normalizeText(q.subject);
        const lowerKey = cleanName.toLowerCase();
        if (cleanName && !subMap.has(lowerKey)) {
          subMap.set(lowerKey, cleanName);
        }
      }
    });

  const available = Array.from(subMap.values());
  const list = available.length > 0 ? available : GLOBAL_SUBJECTS;
  subSelect.innerHTML = list.map(s => `<option value="${s}">${s}</option>`).join("");
  syncPlayChapters();
}

function syncPlayChapters() {
  const playStd = document.getElementById("playStdSelect");
  const subSelect = document.getElementById("playSubSelect");
  const chapSelect = document.getElementById("playChapterSelect");
  const streamSelect = document.getElementById("playStreamSelect");
  if (!playStd || !subSelect || !chapSelect) return;

  const std = playStd.value || "5";
  const sub = normalizeText(subSelect.value || "Science").toLowerCase();
  const selectedStream = normalizeStream(streamSelect ? streamSelect.value : "ncert");
  const chapterMap = new Map();

  masterQuestions
    .filter(q => q.standard === std && normalizeText(q.subject).toLowerCase() === sub && normalizeStream(q.stream) === selectedStream)
    .forEach(q => {
      if (q.chapter) {
        const cleanName = normalizeText(q.chapter);
        const lowerKey = cleanName.toLowerCase();
        if (cleanName && !chapterMap.has(lowerKey)) {
          chapterMap.set(lowerKey, cleanName);
        }
      }
    });

  const uniqueChapters = Array.from(chapterMap.values());
  chapSelect.innerHTML = '<option value="All">All Units / Chapters</option>' + uniqueChapters.map(c => `<option value="${c}">${c}</option>`).join("");
  syncPlayTopics();
}

function syncPlayTopics() {
  const playStd = document.getElementById("playStdSelect");
  const subSelect = document.getElementById("playSubSelect");
  const chapSelect = document.getElementById("playChapterSelect");
  const topicSelect = document.getElementById("playTopicSelect");
  const streamSelect = document.getElementById("playStreamSelect");
  if (!playStd || !subSelect || !chapSelect || !topicSelect) return;

  const std = playStd.value || "5";
  const sub = normalizeText(subSelect.value || "Science").toLowerCase();
  const chap = chapSelect.value || "All";
  const selectedStream = normalizeStream(streamSelect ? streamSelect.value : "ncert");

  let filtered = masterQuestions.filter(q => q.standard === std && normalizeText(q.subject).toLowerCase() === sub && normalizeStream(q.stream) === selectedStream);
  if (chap !== "All") {
    filtered = filtered.filter(q => normalizeText(q.chapter).toLowerCase() === chap.toLowerCase());
  }

  const topicMap = new Map();
  filtered.forEach(q => {
    if (q.topic) {
      const cleanName = normalizeText(q.topic);
      const lowerKey = cleanName.toLowerCase();
      if (cleanName && !topicMap.has(lowerKey)) {
        topicMap.set(lowerKey, cleanName);
      }
    }
  });

  const uniqueTopics = Array.from(topicMap.values());
  topicSelect.innerHTML = '<option value="All">All Topics</option>' + uniqueTopics.map(t => `<option value="${t}">${t}</option>`).join("");
}

function syncAuthorSubjects() {
  const subSelect = document.getElementById("authorSubSelect");
  if (!subSelect) return;
  const allowedSubs = (currentUser && currentUser.subjects && currentUser.subjects.length > 0 && !currentUser.subjects.includes("All")) ? currentUser.subjects : GLOBAL_SUBJECTS;
  subSelect.innerHTML = allowedSubs.map(s => `<option value="${s}">${s}</option>`).join("");
  syncAuthorChapters();
  if (typeof updateAiPromptPreview === "function") updateAiPromptPreview();
}

function syncAuthorChapters() {
  const authStd = document.getElementById("authorStdSelect");
  const subSelect = document.getElementById("authorSubSelect");
  const datalist = document.getElementById("chapterSuggestions");
  if (!authStd || !subSelect || !datalist) return;

  const std = authStd.value;
  const sub = subSelect.value.toLowerCase();
  const matched = masterCurriculum.filter(c => c.standard === std && (c.subject || '').toLowerCase() === sub);
  datalist.innerHTML = matched.map(c => `<option value="${c.chapter}">`).join("");
  if (typeof updateAiPromptPreview === "function") updateAiPromptPreview();
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}

async function handleSignIn() {
  const userId = document.getElementById("loginUserId").value.trim();
  const pass = document.getElementById("loginPassword").value.trim();
  if (!userId || !pass) return alert("Please enter User ID and Password.");

  const payload = { action: "loginUser", userId, password: pass };
  try {
    const data = await callAppsScript(payload);
    if (data && data.success) {
      currentUser = data.user;
      currentUser.studentStream = normalizeStream(currentUser.studentStream);
      localStorage.setItem("hmsUser", JSON.stringify(currentUser));
      closeModal("loginModal");
      
      document.getElementById("loginUserId").value = "";
      document.getElementById("loginPassword").value = "";
      
      await loadPortalData();
      updateAuthUI();
      alert(`Welcome back, ${currentUser.name}! Login recorded in Google Sheet.`);
    } else {
      alert("Sign In failed: " + (data ? data.error : "Unknown error"));
    }
  } catch (err) {
    alert("Connection error: " + err.message);
  }
}

async function handleSignUp() {
  const userType = document.getElementById("signupUserType").value;
  const studentStream = normalizeStream(document.getElementById("signupStudentStream").value);
  const userId = document.getElementById("signupUserId").value.trim();
  const name = document.getElementById("signupName").value.trim();
  const pass = document.getElementById("signupPassword").value.trim();
  const std = document.getElementById("signupStd").value;

  if (!userId || !name || !pass) return alert("Please complete all registration fields.");

  const payload = {
    action: "registerUser", 
    userType: userType, 
    studentStream: studentStream,
    userId: userId, 
    name: name, 
    password: pass, 
    standard: (userType === "aspirant") ? "5,6,7,8,9,10,11,12" : std 
  };

  try {
    const data = await callAppsScript(payload);
    if (data && data.success) {
      currentUser = data.user;
      currentUser.studentStream = normalizeStream(currentUser.studentStream);
      localStorage.setItem("hmsUser", JSON.stringify(currentUser));
      closeModal("signupModal");
      document.getElementById("signupUserId").value = "";
      document.getElementById("signupName").value = "";
      document.getElementById("signupPassword").value = "";
      await loadPortalData();
      updateAuthUI();
      alert(`Registration complete! Welcome, ${currentUser.name}!`);
    } else {
      alert("Registration failed: " + (data ? data.error : "Unknown error"));
    }
  } catch (err) {
    alert("Connection error: " + err.message);
  }
}

function logout() {
  localStorage.removeItem("hmsUser");
  currentUser = null;
  location.reload();
}

function load30DaysChallenge() {
  const container = document.getElementById("challengeGridContainer");
  if (!container) return;

  let completedDays = 0;
  if (currentUser) {
    const challengeKey = `hms_challenge_${currentUser.id}`;
    let savedProgress = localStorage.getItem(challengeKey);
    if (savedProgress) {
      completedDays = parseInt(savedProgress, 10) || 0;
    } else {
      completedDays = Math.min(masterUserScores.length, 30);
    }
  } else {
    completedDays = 0; 
  }

  let html = "";
  for (let day = 1; day <= 30; day++) {
    const isUnlocked = day <= (completedDays + 1);
    const isCompleted = day <= completedDays;

    let statusStyle = isCompleted ? "background: #d4edda; border-color: #28a745; color: #155724;" : 
                      isUnlocked ? "background: #fff; border-color: var(--primary); color: var(--primary);" : 
                      "background: #f1f5f9; border-color: #cbd5e1; color: #94a3b8;";
    
    let badgeText = isCompleted ? "✅ முடிந்தது (Completed)" : isUnlocked ? "🔓 திறந்துள்ளது (Unlocked)" : "🔒 பூட்டப்பட்டுள்ளது (Locked)";

    html += `
      <div class="card" style="margin-bottom:0; padding:15px; text-align:center; ${statusStyle}">
        <h4 style="margin:0 0 8px 0;">நாள் (Day) ${day}</h4>
        <p style="font-size:0.85rem; margin:0 0 10px 0;">${badgeText}</p>
        <button class="btn ${isCompleted ? 'btn-success' : isUnlocked ? 'btn-primary' : 'btn-outline-dark'}" 
                style="width:100%; font-size:0.85rem; padding:6px;" 
                ${!isUnlocked ? 'disabled' : ''} 
                onclick="startChallengeDay(${day})">
          ${isCompleted ? 'மீண்டும் எழுது (Retake)' : isUnlocked ? 'தேவைத் தொடங்கு (Start Test)' : 'பூட்டப்பட்டுள்ளது'}
        </button>
      </div>
    `;
  }
  container.innerHTML = html;
}

function startChallengeDay(dayNumber) {
  const playTabBtn = document.querySelector(".tabs button");
  switchTab('play', playTabBtn);
  alert(`நாள் ${dayNumber} சவால் தேர்வு தொடங்குகிறது!`);
  startQuiz();
}

function switchTab(tab, eventTarget) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  
  const allTabs = [
    "playTab", 
    "dailyPuzzleTab", 
    "createTab", 
    "manageTab", 
    "reportsTab", 
    "teacherScoresTab", 
    "principalTab", 
    "leaderboardTab", 
    "feedbackTab", 
    "myRepliesTab", 
    "challenge30Tab", 
    "ncertBooksTab"
  ];

  allTabs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });

  if (eventTarget) eventTarget.classList.add("active");

  if (tab === "play") document.getElementById("playTab").classList.remove("hidden"), resetQuizView();
  if (tab === "challenge30") document.getElementById("challenge30Tab").classList.remove("hidden"), load30DaysChallenge();
  if (tab === "create") document.getElementById("createTab").classList.remove("hidden"), updateAiPromptPreview();
  if (tab === "manage") document.getElementById("manageTab").classList.remove("hidden"), renderManageTable();
  if (tab === "reports") document.getElementById("reportsTab").classList.remove("hidden"), loadUserReports();
  if (tab === "leaderboard") document.getElementById("leaderboardTab").classList.remove("hidden"), loadLeaderboard();
  if (tab === "teacherScores") document.getElementById("teacherScoresTab").classList.remove("hidden"), loadTeacherStudentScores();
  if (tab === "principal") document.getElementById("principalTab").classList.remove("hidden"), loadPrincipalDashboard();
  if (tab === "feedback") document.getElementById("feedbackTab").classList.remove("hidden"), loadFeedbackTab();
  if (tab === "ncertBooks") document.getElementById("ncertBooksTab").classList.remove("hidden"), initNcertBooksTab();
  if (tab === "myReplies") document.getElementById("myRepliesTab").classList.remove("hidden"), loadStudentReplies();
  if (tab === "dailyPuzzle") {
    const el = document.getElementById("dailyPuzzleTab");
    if (el) el.classList.remove("hidden");
    if (typeof initDailyPuzzleArena === "function") {
      initDailyPuzzleArena();
    }
  }
}

// -------------------------------------------------------------
// DAILY PUZZLE 30-QUESTION ENGINE (SUBJECT-ONLY, ANY CLASS)
// -------------------------------------------------------------
let dailyPuzzleList = [];
let dailyPuzzleIndex = 0;
let dailyPuzzleScore = 0;
let dailyPuzzleStartTime = 0;
const DAILY_PUZZLE_TARGET = 30;

function initDailyPuzzleArena() {
  const subSelect = document.getElementById("dailyPuzzleSubjectSelect");
  if (!subSelect) return;

  const streakKey = currentUser ? `hms_puzzle_streak_${currentUser.id}` : "hms_puzzle_streak_guest";
  const streak = parseInt(localStorage.getItem(streakKey) || "0", 10);
  const streakEl = document.getElementById("dailyPuzzleStreakBadge");
  if (streakEl) streakEl.innerText = `🔥 தொடர் சாதனை: ${streak} நாட்கள்`;

  const availableSubjects = new Set();
  masterQuestions.forEach(q => {
    if (q.subject && q.subject.trim()) {
      availableSubjects.add(q.subject.trim());
    }
  });

  const subs = Array.from(availableSubjects);
  if (subs.length === 0) {
    subSelect.innerHTML = `<option value="">பாடங்கள் இல்லை</option>`;
    document.getElementById("dailyPuzzleCardArea").innerHTML = `
      <div style="text-align:center; padding:20px; color:#dc2626;">
        Questions தாளில் வினாக்கள் எதுவும் கிடைக்கவில்லை.
      </div>`;
    return;
  }

  subSelect.innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join("");
  loadCustomDailyPuzzle();
}

function loadCustomDailyPuzzle() {
  const container = document.getElementById("dailyPuzzleCardArea");
  const sub = document.getElementById("dailyPuzzleSubjectSelect")?.value;
  if (!container || !sub) return;

  const todayStr = new Date().toISOString().split("T")[0];
  const attemptedKey = currentUser 
    ? `hms_puzzle_done_${currentUser.id}_${todayStr}_${sub}` 
    : `hms_puzzle_done_guest_${todayStr}_${sub}`;

  if (localStorage.getItem(attemptedKey)) {
    container.innerHTML = `
      <div style="text-align:center; padding:25px 15px;">
        <div style="font-size:3rem;">🎉</div>
        <h3 style="color:var(--success); margin:10px 0 5px 0;">இன்றைய 30 வினாக்கள் புதிரை முடித்துவிட்டீர்கள்!</h3>
        <p style="color:#64748b; font-size:0.95rem;"><strong>${sub}</strong> பாடப் புதிரை இன்று எழுதிவிட்டீர்கள். வேறு பாடத்தைத் தேர்வு செய்து எழுதலாம் அல்லது நாளை மீண்டும் எழுதலாம்.</p>
      </div>
    `;
    return;
  }

  let matched = masterQuestions.filter(q => 
    q.subject && q.subject.toLowerCase().trim() === sub.toLowerCase().trim()
  );

  if (matched.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:20px; color:#64748b;">இப்பாடத்திற்கு வினாக்கள் கிடைக்கவில்லை.</div>`;
    return;
  }

  const seed = todayStr.split("-").reduce((acc, part) => acc + parseInt(part, 10), 0);
  matched = [...matched].sort((a, b) => {
    const hashA = (a.id.length * seed) % 97;
    const hashB = (b.id.length * seed) % 97;
    return hashA - hashB;
  });

  dailyPuzzleList = matched.slice(0, Math.min(DAILY_PUZZLE_TARGET, matched.length));
  dailyPuzzleIndex = 0;
  dailyPuzzleScore = 0;
  dailyPuzzleStartTime = Date.now();

  renderDailyPuzzleStep();
}

function renderDailyPuzzleStep() {
  const container = document.getElementById("dailyPuzzleCardArea");
  const sub = document.getElementById("dailyPuzzleSubjectSelect")?.value;
  if (!container || dailyPuzzleList.length === 0) return;

  if (dailyPuzzleIndex >= dailyPuzzleList.length) {
    finishDailyPuzzleTest();
    return;
  }

  const q = dailyPuzzleList[dailyPuzzleIndex];
  const qType = (q.type || "mcq").toLowerCase();
  const total = dailyPuzzleList.length;

  let optionsHtml = "";
  if (qType === "tf") {
    optionsHtml = `
      <div class="options-grid" style="grid-template-columns:1fr 1fr; margin-top:15px;">
        <button class="opt-btn text-center" onclick="submitDailyPuzzleChoice('True', this)">✅ True / சரி</button>
        <button class="opt-btn text-center" onclick="submitDailyPuzzleChoice('False', this)">❌ False / தவறு</button>
      </div>
    `;
  } else if (qType === "fib") {
    optionsHtml = `
      <div style="margin-top:15px; display:flex; gap:10px;">
        <input type="text" id="puzzleFibInput" placeholder="விடையை உள்ளிடவும்..." style="font-size:1rem; padding:10px; flex:1;">
        <button class="btn btn-primary" onclick="submitDailyPuzzleChoice(document.getElementById('puzzleFibInput').value.trim(), this)">அடுத்த வினா ⏩</button>
      </div>
    `;
  } else {
    optionsHtml = `
      <div class="options-grid" style="margin-top:15px;">
        <button class="opt-btn" onclick="submitDailyPuzzleChoice('1', this)">A. ${q.optA || ''}</button>
        <button class="opt-btn" onclick="submitDailyPuzzleChoice('2', this)">B. ${q.optB || ''}</button>
        <button class="opt-btn" onclick="submitDailyPuzzleChoice('3', this)">C. ${q.optC || ''}</button>
        <button class="opt-btn" onclick="submitDailyPuzzleChoice('4', this)">D. ${q.optD || ''}</button>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:15px;">
      <span class="badge" style="background:#003366; color:#fff;">${sub} புதிர்</span>
      <span class="badge-pill" style="font-weight:700;">வினா ${dailyPuzzleIndex + 1} / ${total} (வகுப்பு ${q.standard || 'All'})</span>
    </div>
    <div style="font-size:1.15rem; font-weight:600; color:#0f172a; line-height:1.5;">
      ${q.question}
    </div>
    ${optionsHtml}
    <div id="puzzleFeedbackBox" style="margin-top:15px;"></div>
  `;
}

function submitDailyPuzzleChoice(userAnswer, triggerBtn) {
  if (!userAnswer || dailyPuzzleIndex >= dailyPuzzleList.length) return;

  const q = dailyPuzzleList[dailyPuzzleIndex];
  const qType = (q.type || "mcq").toLowerCase();

  let isCorrect = false;
  if (qType === "tf") {
    const rawCorrect = (q.correctOpt || "false").toString().trim().toLowerCase();
    const normalizedCorrect = (rawCorrect === "true" || rawCorrect === "1") ? "true" : "false";
    isCorrect = (userAnswer.toLowerCase() === normalizedCorrect);
  } else if (qType === "fib") {
    isCorrect = (userAnswer.toLowerCase() === (q.correctOpt || "").toString().trim().toLowerCase());
  } else {
    isCorrect = (userAnswer.toString().trim() === (q.correctOpt || "").toString().trim());
  }

  document.querySelectorAll("#dailyPuzzleCardArea button, #dailyPuzzleCardArea input").forEach(el => el.disabled = true);

  const feedback = document.getElementById("puzzleFeedbackBox");
  if (isCorrect) {
    try { soundCorrect.play(); } catch(e) {}
    dailyPuzzleScore++;
    feedback.innerHTML = `<span style="color:#15803d; font-weight:bold;">✅ சரி! அடுத்த வினாவிற்குச் செல்கிறது...</span>`;
  } else {
    try { soundWrong.play(); } catch(e) {}
    feedback.innerHTML = `<span style="color:#b91c1c; font-weight:bold;">❌ தவறு! சரியான விடை: ${q.correctOpt}</span>`;
  }

  setTimeout(() => {
    dailyPuzzleIndex++;
    renderDailyPuzzleStep();
  }, 1200);
}

async function finishDailyPuzzleTest() {
  const container = document.getElementById("dailyPuzzleCardArea");
  const sub = document.getElementById("dailyPuzzleSubjectSelect")?.value;
  const total = dailyPuzzleList.length;
  const totalTimeSec = Math.round((Date.now() - dailyPuzzleStartTime) / 1000);
  const pct = Math.round((dailyPuzzleScore / total) * 100);

  const todayStr = new Date().toISOString().split("T")[0];
  const attemptedKey = currentUser 
    ? `hms_puzzle_done_${currentUser.id}_${todayStr}_${sub}` 
    : `hms_puzzle_done_guest_${todayStr}_${sub}`;
  localStorage.setItem(attemptedKey, "true");

  const streakKey = currentUser ? `hms_puzzle_streak_${currentUser.id}` : "hms_puzzle_streak_guest";
  let currentStreak = parseInt(localStorage.getItem(streakKey) || "0", 10);
  if (pct >= 50) {
    currentStreak += 1;
    localStorage.setItem(streakKey, currentStreak);
    if (typeof confetti === "function") confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
  }

  container.innerHTML = `
    <div style="text-align:center; padding:20px 10px;">
      <h2>🎉 தினசரி புதிர் தேர்வு முடிந்தது!</h2>
      <div style="font-size:2.2rem; font-weight:bold; color:var(--primary); margin:12px 0;">
        ${dailyPuzzleScore} / ${total} (${pct}%)
      </div>
      <p style="color:#475569; font-size:1rem;">
        எடுத்துக்கொண்ட நேரம்: <strong>${totalTimeSec} வினாடிகள்</strong> | உங்கள் தொடர் சாதனை: <strong>${currentStreak} நாட்கள்</strong>
      </p>
      <div style="margin-top:20px;">
        <button class="btn btn-primary" onclick="loadDailyWinners()">🏆 வெற்றியாளர் பட்டியலைப் பார்க்க</button>
      </div>
    </div>
  `;

  const payload = {
    action: "saveScore",
    userId: currentUser ? currentUser.id : "GUEST",
    userName: currentUser ? currentUser.name : "Guest Student",
    standard: "All",
    subject: `[DailyPuzzle] ${sub}`,
    chapter: "Daily 30 Puzzle Challenge",
    topic: `Time: ${totalTimeSec}s`,
    score: dailyPuzzleScore,
    total: total,
    stream: normalizeStream(currentUser ? currentUser.studentStream : "ncert")
  };

  try {
    await callAppsScript(payload);
    if (typeof loadDailyWinners === "function") {
      setTimeout(loadDailyWinners, 1500);
    }
  } catch(e) {
    console.warn("Could not save daily puzzle score:", e);
  }
}

async function loadFeedbackTab() {
  if (!currentUser) return;
  const tbody = document.getElementById("feedbackTableBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">பின்னூட்டங்கள் ஏற்றப்படுகின்றன...</td></tr>`;

  try {
    const res = await fetch(`${SCRIPT_URL}?action=getFeedbackList&userId=${encodeURIComponent(currentUser.id)}`);
    const data = await res.json();
    if (data && data.success) {
      renderFeedbackList(data.feedback || []);
    } else {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">பின்னூட்டம் கிடைக்கவில்லை.</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">பிழை: ${err.message}</td></tr>`;
  }
}

function initNcertBooksTab() {
  const viewStdSelect = document.getElementById("ncertViewStdSelect");
  if (viewStdSelect && GLOBAL_STANDARDS) {
    let allowed = GLOBAL_STANDARDS;
    if (currentUser && currentUser.role === "student" && currentUser.standards && currentUser.standards.length > 0) {
      allowed = currentUser.standards;
    }
    viewStdSelect.innerHTML = allowed.map(s => `<option value="${s}">வகுப்பு ${s}</option>`).join("");
    if (currentUser && currentUser.role === "student" && currentUser.standards && currentUser.standards.length > 0) {
      viewStdSelect.value = currentUser.standards[0];
    }
  }
  const viewStream = document.getElementById("ncertViewStreamSelect");
  if (viewStream && currentUser && currentUser.studentStream) {
    viewStream.value = normalizeStream(currentUser.studentStream);
  }
  renderNcertBooksViewer();
}

async function saveNcertDriveLink() {
  const stream = normalizeStream(document.getElementById("configBookStream").value);
  const std = (document.getElementById("ncertConfigStd").value || "").replace(/[^0-9a-zA-Z\-]/g, "");
  const sub = document.getElementById("ncertConfigSub").value;
  const url = document.getElementById("ncertDriveUrlInput").value.trim();

  if (!url) return alert("தயவுசெய்து கூகுள் டிரைவ் இணைப்பை (Drive URL) உள்ளிடவும்.");

  const saveBtn = document.querySelector("#ncertManagerSection button");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = "⏳ கூகுள் ஷீட்டில் சேமிக்கப்படுகிறது...";
  }

  const payload = {
    action: "saveBookLink",
    stream: stream,
    standard: std,
    subject: sub,
    url: url,
    updatedBy: currentUser ? `${currentUser.name} (${currentUser.role.toUpperCase()})` : "Principal"
  };

  try {
    const res = await callAppsScript(payload);
    if (res && res.success) {
      alert(`✅ [${getStreamLabel(stream)}] வகுப்பு ${std} - ${sub} பாடத்திற்கான டிரைவ் இணைப்பு கூகுள் ஷீட்டில் சேமிக்கப்பட்டது!`);
      document.getElementById("ncertDriveUrlInput").value = "";
      await loadPortalData();
    } else {
      alert("பிழை: கூகுள் ஷீட்டில் சேமிக்க முடியவில்லை.");
    }
  } catch (err) {
    alert("இணைப்புப் பிழை: " + err.message);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = "💾 டிரைவ் இணைப்பைச் சேமி (Save Link)";
    }
  }
}

function renderNcertBooksViewer() {
  const streamSelect = document.getElementById("ncertViewStreamSelect");
  const stdSelect = document.getElementById("ncertViewStdSelect");
  const searchInput = document.getElementById("ncertSearchInput");
  const container = document.getElementById("ncertBooksGridContainer");
  if (!container || !stdSelect) return;

  const stream = normalizeStream(streamSelect ? streamSelect.value : "ncert");
  const rawStd = stdSelect.value || "5";
  const std = rawStd.replace(/[^0-9a-zA-Z\-]/g, "").trim();
  const search = searchInput ? searchInput.value.toLowerCase() : "";

  let html = "";
  let matchedCount = 0;

  GLOBAL_SUBJECTS.forEach(sub => {
    if (search && !sub.toLowerCase().includes(search)) return;

    const record = masterBookLinks.find(item => {
      const itemStream = normalizeStream(item.stream);
      const itemStd = (item.standard || "").toString().replace(/[^0-9a-zA-Z\-]/g, "").trim();
      const itemSub = (item.subject || "").toString().trim().toLowerCase();
      
      return itemStream === stream && 
             itemStd.toLowerCase() === std.toLowerCase() && 
             itemSub === sub.toLowerCase();
    });

    const hasLink = record && record.url && record.url.length > 5;
    matchedCount++;

    html += `
      <div class="card" style="margin-bottom:0; padding:15px; text-align:center; background:${hasLink ? '#f0fdf4' : '#fff'}; border-color:${hasLink ? '#bbf7d0' : 'var(--border)'};">
        <div style="font-size:2rem; margin-bottom:8px;">📖</div>
        <h4 style="margin:0 0 6px 0; color:var(--primary);">${sub}</h4>
        <p style="font-size:0.85rem; color:#64748b; margin:0 0 12px 0;">[${getStreamLabel(stream)}] வகுப்பு ${std} புத்தகம்</p>
        ${hasLink ? `
          <a href="${record.url}" target="_blank" class="btn btn-success" style="width:100%; font-size:0.85rem; padding:8px; text-decoration:none;">
            📂 டிரைவ் கோப்பகத்தைத் திற (Open Drive)
          </a>
          <div style="font-size:0.75rem; color:#15803d; margin-top:6px;">புதுப்பிக்கப்பட்டது: ${record.date || 'recently'}</div>
        ` : `
          <button class="btn btn-outline-dark" style="width:100%; font-size:0.85rem; padding:8px;" disabled>
            ⏳ இணைப்பு விரைவில் இணைக்கப்படும்
          </button>
        `}
      </div>
    `;
  });

  if (matchedCount === 0) {
    container.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; color:#64748b; padding:20px;">பாடங்கள் எதுவும் கிடைக்கவில்லை.</div>`;
  } else {
    container.innerHTML = html;
  }
}

function renderFeedbackList(list) {
  const tbody = document.getElementById("feedbackTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">மாணவர்கள் இன்னும் எந்தச் சந்தேகமும் அனுப்பவில்லை.</td></tr>`;
    return;
  }

  list.forEach(item => {
    const hasReply = Boolean(item.reply);
    tbody.innerHTML += `
      <tr>
        <td><strong>${item.userName}</strong><br><small style="color:#64748b;">(${item.userId})</small></td>
        <td>வகுப்பு ${item.standard}<br><small>${item.subject}</small></td>
        <td><span class="badge badge-success">${item.score}</span></td>
        <td style="max-width:250px; word-break:break-word;">
          <strong>${item.message}</strong><br>
          <small style="color:#64748b;">${item.date}</small>
        </td>
        <td style="max-width:260px;">
          ${hasReply ? `
            <div style="background:#e8f4fd; border-left:3px solid var(--primary); padding:6px 10px; border-radius:4px; font-size:0.88rem;">
              <strong>${item.reply}</strong><br>
              <small style="color:#084298;">— ${item.repliedBy} (${item.repliedAt})</small>
            </div>
          ` : `
            <textarea id="replyText_${item.id}" rows="2" placeholder="பதிலை உள்ளிடவும்..." style="font-size:0.85rem; padding:6px; width:100%;"></textarea>
          `}
        </td>
        <td>
          ${hasReply ? `
            <span class="badge badge-success">பதிலளிக்கப்பட்டது</span>
          ` : `
            <button class="btn btn-primary" style="padding:4px 10px; font-size:0.82rem;" onclick="submitTeacherReply('${item.id}')">அனுப்பு</button>
          `}
        </td>
      </tr>
    `;
  });
}

async function submitTeacherReply(feedbackId) {
  const input = document.getElementById(`replyText_${feedbackId}`);
  const text = input ? input.value.trim() : "";
  if (!text) return alert("தயவுசெய்து பதிலை எழுதவும்.");

  const payload = {
    action: "replyTeacherFeedback", 
    feedbackId: feedbackId, 
    replyText: text, 
    replierName: currentUser ? `${currentUser.name} (${currentUser.role.toUpperCase()})` : "Teacher" 
  };

  const res = await callAppsScript(payload);
  if (res && res.success) {
    alert("✅ மாணவருக்குப் பதில் அனுப்பப்பட்டது!");
    loadFeedbackTab();
  } else {
    alert("பதில் அனுப்புவதில் பிழை ஏற்பட்டது.");
  }
}

async function loadStudentReplies() {
  if (!currentUser) return;
  const container = document.getElementById("studentRepliesContainer");
  if (!container) return;
  container.innerHTML = "<p style='text-align:center;'>பதில்கள் ஏற்றப்படுகின்றன...</p>";

  try {
    const searchParam = encodeURIComponent(currentUser.id || currentUser.name);
    const res = await fetch(`${SCRIPT_URL}?action=getUserFeedback&userId=${searchParam}`);
    const data = await res.json();

    if (data && data.success && data.feedback && data.feedback.length > 0) {
      container.innerHTML = data.feedback.map((item, idx) => `
        <div class="card" style="margin-bottom:12px; border-left:4px solid ${item.reply ? 'var(--accent)' : 'var(--secondary)'}; padding:14px; text-align:left;">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <strong>${idx + 1}. வகுப்பு ${item.standard} • ${item.subject}</strong>
            <small style="color:#64748b;">${item.date}</small>
          </div>
          <p style="margin:4px 0 10px 0; color:#1e293b;"><strong>உங்கள் சந்தேகம்:</strong> "${item.message}"</p>
          ${item.reply ? `
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:10px; color:#166534;">
              <strong>🧑‍🏫 ஆசிரியரின் பதில்:</strong> ${item.reply}
              <div style="font-size:0.78rem; margin-top:4px; color:#15803d;">வழங்கியவர்: ${item.repliedBy} (${item.repliedAt})</div>
            </div>
          ` : `
            <span class="badge" style="background:#fef3c7; color:#92400e;">⏳ ஆசிரியர் இன்னும் பதிலளிக்கவில்லை</span>
          `}
        </div>
      `).join("");
    } else {
      container.innerHTML = "<p style='text-align:center; color:#64748b;'>நீங்கள் இன்னும் எந்தச் சந்தேகமும் ஆசிரியரிடம் கேட்கவில்லை.</p>";
    }
  } catch (err) {
    container.innerHTML = `<p style='text-align:center; color:red;'>பிழை: ${err.message}</p>`;
  }
}

function resetQuizView() {
  clearInterval(timerInterval);
  clearTimeout(autoNextTimeout);
  document.getElementById("quizSetupCard").classList.remove("hidden");
  document.getElementById("quizActiveCard").classList.add("hidden");
  document.getElementById("quizResultCard").classList.add("hidden");
  const rev = document.getElementById("quizReviewArea");
  if (rev) rev.classList.add("hidden");
  const bAlert = document.getElementById("bonusRewardAlert");
  if (bAlert) bAlert.classList.add("hidden");
}

function toggleSelectAll(isAll) {
  if (!currentUser) return;
  const countInput = document.getElementById("playCountInput");
  countInput.disabled = isAll;
  countInput.style.background = isAll ? "#e9ecef" : "#fff";
}

function speakText(text, onComplete) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    currentUtterance = new SpeechSynthesisUtterance(text);
    
    const isTamil = (activeTestLanguage === 'ta') || /[\u0B80-\u0BFF]/.test(text);
    currentUtterance.lang = isTamil ? 'ta-IN' : 'en-US';
    currentUtterance.rate = 0.9;

    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(v => v.lang.startsWith(isTamil ? 'ta' : 'en'));
    if (targetVoice) currentUtterance.voice = targetVoice;

    currentUtterance.onend = () => { currentUtterance = null; if (typeof onComplete === "function") onComplete(); };
    currentUtterance.onerror = () => { currentUtterance = null; if (typeof onComplete === "function") onComplete(); };

    window.speechSynthesis.speak(currentUtterance);
  } else if (typeof onComplete === "function") {
    onComplete();
  }
}

async function translateTestContent(targetLang) {
  activeTestLanguage = targetLang;
  renderCurrentQuestion();
}

async function translateTextContent(text, targetLang) {
  if (!text || targetLang === 'en') return text;
  
  try {
    const payload = {
      action: "translateText",
      text: text,
      targetLang: targetLang
    };
    
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (data && data.success) {
      return data.translated;
    }
  } catch (e) {
    console.warn("Apps Script Translation fallback:", e);
  }
  
  return text + " [தமிழ்]";
}

async function startQuiz() {
  const streamEl = document.getElementById("playStreamSelect");
  const typeEl = document.getElementById("playTypeSelect");
  const stdEl = document.getElementById("playStdSelect");
  const subEl = document.getElementById("playSubSelect");
  const chapEl = document.getElementById("playChapterSelect");
  const topicEl = document.getElementById("playTopicSelect");
  const keywordEl = document.getElementById("playKeywordInput");
  const allCb = document.getElementById("playAllCheckbox");
  const modeEl = document.getElementById("playAssessmentMode");
  const countEl = document.getElementById("playCountInput");
  const timerEl = document.getElementById("playTimerSelect");

  const chosenStream = normalizeStream(streamEl ? streamEl.value : "ncert");
  const chosenType = typeEl ? typeEl.value : "all";
  const std = stdEl ? stdEl.value : "5";
  const sub = subEl && subEl.value ? normalizeText(subEl.value).toLowerCase() : "science";
  const keyword = keywordEl ? keywordEl.value.toLowerCase().trim() : "";
  const isAspirant = currentUser && currentUser.role === "aspirant";
  const isPrincipal = currentUser && currentUser.role === "principal";
  const isAll = currentUser && allCb && allCb.checked;
  
  currentAssessmentMode = modeEl ? modeEl.value : "text";

  let count = countEl ? (parseInt(countEl.value, 10) || 5) : 5;
  perQuestionTime = timerEl ? Number(timerEl.value) : 20;

  let matched = masterQuestions.filter(q => {
    const mStream = normalizeStream(q.stream) === chosenStream;
    const mType = (chosenType === "all" || (q.type || "mcq").toLowerCase() === chosenType);

    if (keyword && (isAspirant || isPrincipal)) {
      const searchableText = `${q.question || ""} ${q.topic || ""} ${q.chapter || ""} ${q.subject || ""} ${q.explanation || ""}`.toLowerCase();
      return mStream && mType && searchableText.includes(keyword);
    }

    const mStd = q.standard.toString().trim() === std.toString().trim();
    const mSub = normalizeText(q.subject).toLowerCase() === sub;
    const chap = chapEl ? chapEl.value : "All";
    const mChap = (chap === "All" || normalizeText(q.chapter).toLowerCase() === chap.toLowerCase());
    
    const searchableText = `${q.question || ""} ${q.topic || ""} ${q.chapter || ""}`.toLowerCase();
    const mKeyword = !keyword || searchableText.includes(keyword);

    return mStream && mType && mStd && mSub && mChap && mKeyword;
  });

  if (matched.length === 0) {
    return alert(keyword ? `No questions found matching keyword "${keyword}".` : `No questions found matching your filter.`);
  }

  matched.sort(() => Math.random() - 0.5);
  if (!isAll) matched = matched.slice(0, Math.min(count, matched.length));

  activeQuizList = matched;
  examReviewRecord = [];
  wrongQuestionsVault = [];
  currentQIndex = 0;
  userScore = 0;

  const startBtn = document.querySelector("#quizSetupCard button.btn-primary");
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.innerHTML = "⏳ வினாக்கள் தயாராகின்றன (Preparing Assessment)...";
  }

  setTimeout(() => {
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerHTML = "🚀 Start Assessment";
    }
    document.getElementById("quizSetupCard").classList.add("hidden");
    document.getElementById("quizResultCard").classList.add("hidden");
    document.getElementById("quizActiveCard").classList.remove("hidden");
    renderCurrentQuestion();
  }, 700);
}

async function renderCurrentQuestion() {
  clearInterval(timerInterval);
  clearTimeout(autoNextTimeout);
  isAnswered = false;

  if (recognitionInstance) {
    try { recognitionInstance.stop(); } catch(e) {}
  }

  if (!activeQuizList || activeQuizList.length === 0 || currentQIndex >= activeQuizList.length) {
    finishQuiz();
    return;
  }

  const q = activeQuizList[currentQIndex];
  if (!q) {
    nextQuestion(false);
    return;
  }

  const total = activeQuizList.length;
  const qType = (q.type || "mcq").toLowerCase();

  const labels = {
    mcq: "Multiple Choice Question",
    tf: "True or False",
    fib: "Fill in the Blanks",
    match: "Match the Following"
  };

  const badgeEl = document.getElementById("quizProgressBadge");
  if (badgeEl) badgeEl.innerText = `Question ${currentQIndex + 1} of ${total} | [${(labels[qType] || qType).toUpperCase()}]`;
  
  const nextBtn = document.getElementById("btnNextQuestion");
  if (nextBtn) nextBtn.innerText = (currentQIndex === total - 1) ? "Submit Test 🏁" : "Next Question ⏩";

  const area = document.getElementById("singleQuestionArea");
  if (!area) return;

  let questionText = q.question || q.prompt || "Question statement missing";
  if (activeTestLanguage === 'ta') {
    questionText = await translateTextContent(questionText, 'ta');
  }

  const safeQuestionText = questionText.replace(/'/g, "\\'");
  const audioBtnHtml = `<button class="btn btn-outline-dark voice-btn" onclick="speakText('${safeQuestionText}')" title="கேள்வியை வாசி">🔊</button>`;

  if (qType === "tf") {
    area.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <h3 style="margin-top:0; font-size:1.15rem; flex:1;">${questionText}</h3>
        ${audioBtnHtml}
      </div>
      <div class="options-grid" style="grid-template-columns: 1fr 1fr; margin-top:20px;">
        <button class="opt-btn text-center" style="font-size:1.1rem; font-weight:bold;" onclick="checkTfAnswer('True', this)">✅ True / சரி</button>
        <button class="opt-btn text-center" style="font-size:1.1rem; font-weight:bold;" onclick="checkTfAnswer('False', this)">❌ False / தவறு</button>
      </div>
      <div id="explanationBoxArea"></div>
    `;
  } else if (qType === "fib") {
    area.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <h3 style="margin-top:0; font-size:1.15rem; flex:1;">${questionText}</h3>
        ${audioBtnHtml}
      </div>
      <div style="margin-top:20px; display:flex; gap:10px;">
        <input type="text" id="fibInput" placeholder="Type your answer here..." style="font-size:1rem; padding:10px; flex:1;">
        <button class="btn btn-primary" id="btnSubmitFib" onclick="checkFibAnswer()">Submit</button>
      </div>
      <div id="fibFeedback" style="margin-top:10px; font-weight:bold;"></div>
      <div id="explanationBoxArea"></div>
    `;
  } else if (qType === "match") {
    const rawPairs = [q.optA, q.optB, q.optC, q.optD].filter(Boolean);
    const leftItems = [];
    const rightItems = [];

    for (let p of rawPairs) {
      const parts = p.split(":");
      let left = parts[0] ? parts[0].trim() : "";
      let right = parts[1] ? parts[1].trim() : "";

      if (activeTestLanguage === 'ta') {
        left = await translateTextContent(left, 'ta');
        right = await translateTextContent(right, 'ta');
      }

      leftItems.push(left);
      rightItems.push(right);
    }

    const shuffledRights = [...rightItems].sort(() => Math.random() - 0.5);

    let rowsHtml = leftItems.map((left, idx) => `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; background:#f8f9fa; padding:10px; border-radius:6px; border:1px solid var(--border);">
        <span style="font-weight:600; width:45%;">${idx + 1}. ${left}</span>
        <span style="width:10%; text-align:center;">➡️</span>
        <select class="match-select" data-left="${left}" style="width:45%; padding:8px;">
          <option value="">-- Select Match --</option>
          ${shuffledRights.map(r => `<option value="${r}">${r}</option>`).join("")}
        </select>
      </div>
    `).join("");

    area.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <h3 style="margin-top:0; font-size:1.15rem; flex:1;">${questionText}</h3>
        ${audioBtnHtml}
      </div>
      <div style="margin-top:15px;">${rowsHtml}</div>
      <button class="btn btn-primary margin-top" id="btnSubmitMatch" onclick="checkMatchAnswer()">Check Matches</button>
      <div id="explanationBoxArea"></div>
    `;
  } else {
    let optA = q.optA || '';
    let optB = q.optB || '';
    let optC = q.optC || '';
    let optD = q.optD || '';

    if (activeTestLanguage === 'ta') {
      optA = await translateTextContent(optA, 'ta');
      optB = await translateTextContent(optB, 'ta');
      optC = await translateTextContent(optC, 'ta');
      optD = await translateTextContent(optD, 'ta');
    }

    area.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <h3 style="margin-top:0; font-size:1.15rem; flex:1;">${questionText}</h3>
        ${audioBtnHtml}
      </div>
      <div class="options-grid">
        <button class="opt-btn" onclick="checkMcqAnswer('1', this)">A. ${optA}</button>
        <button class="opt-btn" onclick="checkMcqAnswer('2', this)">B. ${optB}</button>
        <button class="opt-btn" onclick="checkMcqAnswer('3', this)">C. ${optC}</button>
        <button class="opt-btn" onclick="checkMcqAnswer('4', this)">D. ${optD}</button>
      </div>
      <div id="explanationBoxArea"></div>
    `;
  }

  setupTimer();

  let speechText = questionText;
  if (qType === "mcq") {
    let optA = await translateTextContent(q.optA || '', activeTestLanguage);
    let optB = await translateTextContent(q.optB || '', activeTestLanguage);
    let optC = await translateTextContent(q.optC || '', activeTestLanguage);
    let optD = await translateTextContent(q.optD || '', activeTestLanguage);
    speechText += `. Option A: ${optA}. Option B: ${optB}. Option C: ${optC}. Option D: ${optD}.`;
  } else if (qType === "tf") {
    speechText += activeTestLanguage === 'ta' ? `. சரி அல்லது தவறு?` : `. True or False?`;
  } else if (qType === "fib") {
    speechText += activeTestLanguage === 'ta' ? `. கோடிட்ட இடத்தை நிரப்புக.` : `. Fill in the blank.`;
  } else if (qType === "match") {
    speechText += activeTestLanguage === 'ta' ? `. ${questionText}` : `. ${questionText}`;
  }

  speakText(speechText, () => {
    if (currentAssessmentMode === "voice" && !isAnswered) {
      startVoiceListeningSession(qType);
    }
  });
}

function startVoiceListeningSession(qType) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  recognitionInstance = new SpeechRecognition();
  recognitionInstance.lang = 'en-US';
  recognitionInstance.interimResults = true;
  recognitionInstance.maxAlternatives = 1;

  recognitionInstance.onstart = function() {
    const transcriptBox = document.getElementById("voiceTranscriptBox");
    if (transcriptBox) transcriptBox.innerText = "🎙️ கேட்கிறது (Listening)... பேசவும்...";
  };

  recognitionInstance.onresult = function(event) {
    if (isAnswered) return;
    
    const spokenText = event.results[0][0].transcript.trim().toLowerCase();
    const transcriptBox = document.getElementById("voiceTranscriptBox");
    if (transcriptBox) {
      transcriptBox.innerText = `🗣️ நீங்கள் கூறியது: "${spokenText}"`;
    }

    const q = activeQuizList[currentQIndex];
    if (!q) return;

    const qType = (q.type || "mcq").toLowerCase();

    if (qType === "mcq") {
      if (spokenText.includes("a") || spokenText.includes("1") || spokenText.includes("முதல்")) {
        checkMcqAnswer('1', document.querySelectorAll(".opt-btn")[0]);
      } else if (spokenText.includes("b") || spokenText.includes("2")) {
        checkMcqAnswer('2', document.querySelectorAll(".opt-btn")[1]);
      } else if (spokenText.includes("c") || spokenText.includes("3")) {
        checkMcqAnswer('3', document.querySelectorAll(".opt-btn")[2]);
      } else if (spokenText.includes("d") || spokenText.includes("4")) {
        checkMcqAnswer('4', document.querySelectorAll(".opt-btn")[3]);
      }
    } 
    else if (qType === "tf") {
      if (spokenText.includes("true") || spokenText.includes("சரி") || spokenText.includes("a")) {
        checkTfAnswer('True', document.querySelectorAll(".opt-btn")[0]);
      } else if (spokenText.includes("false") || spokenText.includes("தவறு") || spokenText.includes("b")) {
        checkTfAnswer('False', document.querySelectorAll(".opt-btn")[1]);
      }
    }
    else if (qType === "fib") {
      const input = document.getElementById("fibInput");
      if (input) {
        let finalAns = spokenText;
        const correctAns = (q.correctOpt || "").toString().trim().toLowerCase();
        
        if (correctAns === "gas" && (finalAns === "guess" || finalAns === "gas")) {
          finalAns = "gas";
        }

        input.value = finalAns;
        checkFibAnswer();
      }
    }
  };

  recognitionInstance.onerror = function(event) {
    const transcriptBox = document.getElementById("voiceTranscriptBox");
    if (transcriptBox) transcriptBox.innerText = "⚠️ குரல் அடையாளம் காணப்படவில்லை. மீண்டும் முயற்சிக்கவும்.";
  };

  recognitionInstance.start();
}

function setupTimer() {
  const timerBadge = document.getElementById("timerContainer");
  const track = document.getElementById("timerBarTrack");
  const fill = document.getElementById("timerBarFill");

  if (perQuestionTime > 0) {
    timerBadge.classList.remove("hidden");
    track.classList.remove("hidden");
    timeRemaining = perQuestionTime;
    document.getElementById("timerText").innerText = `${timeRemaining}s`;
    fill.style.width = "100%";

    timerInterval = setInterval(() => {
      timeRemaining--; 
      document.getElementById("timerText").innerText = `${timeRemaining}s`;
      fill.style.width = `${(timeRemaining / perQuestionTime) * 100}%`;

      if (timeRemaining <= 5) timerBadge.classList.add("danger");
      else timerBadge.classList.remove("danger");

      if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        handleTimeUp();
      }
    }, 1000);
  } else {
    timerBadge.classList.add("hidden");
    track.classList.add("hidden");
  }
}

function showExplanationBox() {
  const q = activeQuizList[currentQIndex];
  const boxArea = document.getElementById("explanationBoxArea");
  if (!boxArea) return;

  const safeQ = encodeURIComponent(q.question || "");
  const safeExp = encodeURIComponent(q.explanation || "");

  boxArea.innerHTML = `
    <div class="explanation-card" style="margin-top:15px; background:#f0fdf4; border:1px solid #bbf7d0; padding:12px; border-radius:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong style="color:#166534;">💡 ஆசிரியர் விளக்கம் (${getStreamLabel(q.stream)})</strong>
        <button class="btn btn-outline-dark" style="font-size:0.75rem; padding:4px 8px;" onclick="fetchAiDoubtClarification('${safeQ}', '${safeExp}')">🤖 Ask AI for Detailed Doubt Clarification</button>
      </div>
      <div id="aiDoubtContent">${q.explanation || 'சரிபார்க்கப்பட்டது.'}</div>
    </div>
  `;
}

async function fetchAiDoubtClarification(questionText, baseExplanation) {
  const container = document.getElementById("aiDoubtContent");
  if (!container) return;

  const decodedQ = decodeURIComponent(questionText);
  const decodedExp = decodeURIComponent(baseExplanation);

  container.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; color:#0369a1; padding:10px 0; font-weight:600;">
      <span>⏳</span>
      <span>ஆசிரியர் AI விரிவான விளக்கத்தை உருவாக்குகிறது (Teacher AI is generating a detailed step-by-step breakdown)...</span>
    </div>
  `;

  try {
    const payload = {
      action: "getAiDoubtExplanation",
      question: decodedQ,
      context: decodedExp,
      language: activeTestLanguage
    };

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (data && data.success && data.explanation) {
      container.innerHTML = `
        <div style="margin-top:10px; padding:15px; background:#ffffff; border-radius:8px; border:1.5px solid #bbf7d0; box-shadow:0 2px 4px rgba(0,0,0,0.04); color:#0f172a; line-height:1.6;">
          <div style="color:#15803d; font-weight:700; font-size:1.05rem; margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">
            🧑‍🏫 ஆசிரியர் விரிவான விளக்கம் (Teacher In-Depth Explanation):
          </div>
          ${data.explanation}
        </div>
      `;
    } else {
      container.innerHTML = `<div style="color:#166534; padding:8px 0;">${decodedExp}</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div style="color:#166534; padding:8px 0;">${decodedExp}</div>`;
  }
}

function checkMcqAnswer(selected, btn) {
  if (isAnswered) return;
  isAnswered = true;
  clearInterval(timerInterval);

  const q = activeQuizList[currentQIndex];
  const correct = q.correctOpt.toString().trim();
  const buttons = btn.parentElement.querySelectorAll(".opt-btn");
  buttons.forEach(b => b.disabled = true);

  const isCorrect = (selected === correct);
  if (isCorrect) {
    try { soundCorrect.play(); } catch(e) {} 
    btn.classList.add("correct");
    userScore++;
  } else {
    try { soundWrong.play(); } catch(e) {} 
    btn.classList.add("wrong");
    const idx = parseInt(correct, 10) - 1;
    if (buttons[idx]) buttons[idx].classList.add("correct");
    wrongQuestionsVault.push(q);
  }

  const optMap = { "1": q.optA, "2": q.optB, "3": q.optC, "4": q.optD };
  examReviewRecord.push({
    question: q,
    userChoice: `Option ${selected} (${optMap[selected] || ''})`, 
    correctChoice: `Option ${correct} (${optMap[correct] || ''})`, 
    isCorrect: isCorrect 
  });

  showExplanationBox();
  if (perQuestionTime > 0) autoNextTimeout = setTimeout(() => nextQuestion(true), 4500);
}

function checkTfAnswer(selected, btn) {
  if (isAnswered) return;
  isAnswered = true;
  clearInterval(timerInterval);

  const q = activeQuizList[currentQIndex];
  let rawCorrect = (q.correctOpt !== undefined && q.correctOpt !== null) ? q.correctOpt.toString().trim().toLowerCase() : "false";
  let normalizedCorrect = (rawCorrect === "true" || rawCorrect === "1" || rawCorrect === "t") ? "true" : "false";

  const selectedNorm = selected.toString().trim().toLowerCase();
  const isCorrect = (selectedNorm === normalizedCorrect);

  const buttons = btn.parentElement.querySelectorAll(".opt-btn");
  buttons.forEach(b => b.disabled = true);

  const trueBtn = buttons[0];
  const falseBtn = buttons[1];
  const correctBtn = (normalizedCorrect === "true") ? trueBtn : falseBtn;

  if (isCorrect) {
    try { soundCorrect.play(); } catch(e) {}
    btn.classList.add("correct");
    userScore++;
  } else {
    try { soundWrong.play(); } catch(e) {}
    btn.classList.add("wrong");
    if (correctBtn) correctBtn.classList.add("correct");
    wrongQuestionsVault.push(q);
  }

  examReviewRecord.push({
    question: q,
    userChoice: (selectedNorm === "true") ? "True" : "False",
    correctChoice: (normalizedCorrect === "true") ? "True" : "False",
    isCorrect: isCorrect
  });

  showExplanationBox();
  if (perQuestionTime > 0) autoNextTimeout = setTimeout(() => nextQuestion(true), 4500);
}

function checkFibAnswer() {
  if (isAnswered) return;
  const input = document.getElementById("fibInput");
  const userAns = (input ? input.value : "").trim();
  if (!userAns) return alert("Please type your answer.");

  isAnswered = true;
  clearInterval(timerInterval);
  input.disabled = true;
  const btnSubmit = document.getElementById("btnSubmitFib");
  if (btnSubmit) btnSubmit.disabled = true;

  const q = activeQuizList[currentQIndex];
  const correct = q.correctOpt.toString().trim().toLowerCase();
  const feed = document.getElementById("fibFeedback");

  const isCorrect = (userAns.toLowerCase() === correct);
  if (isCorrect) {
    try { soundCorrect.play(); } catch(e) {} 
    feed.style.color = "var(--accent)";
    feed.innerText = "✅ Correct Answer!";
    userScore++;
  } else {
    try { soundWrong.play(); } catch(e) {} 
    feed.style.color = "var(--danger)";
    feed.innerText = `❌ Incorrect! Correct Answer: "${q.correctOpt}"`;
    wrongQuestionsVault.push(q);
  }

  examReviewRecord.push({
    question: q,
    userChoice: userAns, 
    correctChoice: q.correctOpt, 
    isCorrect: isCorrect 
  });

  showExplanationBox();
  if (perQuestionTime > 0) autoNextTimeout = setTimeout(() => nextQuestion(true), 4500);
}

function checkMatchAnswer() {
  if (isAnswered) return;
  const selects = document.querySelectorAll(".match-select");
  let allChosen = true;
  selects.forEach(s => { if (!s.value) allChosen = false; });
  if (!allChosen) return alert("Please pick an option for each row.");

  isAnswered = true;
  clearInterval(timerInterval);
  selects.forEach(s => s.disabled = true);
  const btnSubmit = document.getElementById("btnSubmitMatch");
  if (btnSubmit) btnSubmit.disabled = true;

  const q = activeQuizList[currentQIndex];
  const pairMap = {};
  [q.optA, q.optB, q.optC, q.optD].filter(Boolean).forEach(p => { 
    const [l, r] = p.split(":");
    if (l && r) pairMap[l.trim().toLowerCase()] = r.trim().toLowerCase();
  });

  let correctCount = 0;
  const userPairs = [];
  selects.forEach(s => {
    const left = (s.getAttribute("data-left") || "").toLowerCase().trim();
    userPairs.push(`${left} -> ${s.value.trim()}`);
    if (pairMap[left] && pairMap[left] === s.value.trim().toLowerCase()) { 
      s.style.borderColor = "var(--accent)";
      s.style.backgroundColor = "var(--success-bg)";
      correctCount++;
    } else {
      s.style.borderColor = "var(--danger)";
      s.style.backgroundColor = "var(--danger-bg)";
    }
  });

  const isCorrect = (correctCount === selects.length);
  if (isCorrect) {
    try { soundCorrect.play(); } catch(e) {} 
    userScore++;
  } else {
    try { soundWrong.play(); } catch(e) {} 
    wrongQuestionsVault.push(q);
  }

  examReviewRecord.push({
    question: q,
    userChoice: userPairs.join("; "), 
    correctChoice: [q.optA, q.optB, q.optC, q.optD].filter(Boolean).join("; "), 
    isCorrect: isCorrect 
  });

  showExplanationBox();
  if (perQuestionTime > 0) autoNextTimeout = setTimeout(() => nextQuestion(true), 5500);
}

function handleTimeUp() {
  if (isAnswered) return;
  isAnswered = true;

  const q = activeQuizList[currentQIndex];
  const qType = (q.type || "mcq").toLowerCase();

  try { soundWrong.play(); } catch(e) {} 

  if (qType === "mcq") {
    const correct = parseInt(q.correctOpt, 10);
    const buttons = document.querySelectorAll("#singleQuestionArea .opt-btn");
    buttons.forEach(b => b.disabled = true);
    if (buttons[correct - 1]) buttons[correct - 1].classList.add("correct");
  } else if (qType === "tf") {
    const correct = q.correctOpt.toString().trim().toLowerCase();
    const buttons = document.querySelectorAll("#singleQuestionArea .opt-btn");
    buttons.forEach(b => {
      b.disabled = true;
      if (b.innerText.toLowerCase().includes(correct)) b.classList.add("correct");
    });
  } else if (qType === "fib") {
    const input = document.getElementById("fibInput");
    if (input) input.disabled = true;
    const btnSubmit = document.getElementById("btnSubmitFib");
    if (btnSubmit) btnSubmit.disabled = true;
    const feed = document.getElementById("fibFeedback");
    if (feed) {
      feed.style.color = "var(--danger)";
      feed.innerText = `⏰ Time's up! Correct Answer: "${q.correctOpt}"`;
    }
  } else if (qType === "match") {
    document.querySelectorAll(".match-select").forEach(s => s.disabled = true);
    const btnSubmit = document.getElementById("btnSubmitMatch");
    if (btnSubmit) btnSubmit.disabled = true;
  }

  wrongQuestionsVault.push(q);
  examReviewRecord.push({
    question: q,
    userChoice: "Time Out", 
    correctChoice: q.correctOpt, 
    isCorrect: false 
  });

  showExplanationBox();
  autoNextTimeout = setTimeout(() => nextQuestion(true), 4500);
}

function nextQuestion(auto) {
  clearInterval(timerInterval);
  clearTimeout(autoNextTimeout);

  if (currentQIndex < activeQuizList.length - 1) {
    currentQIndex++;
    renderCurrentQuestion();
  } else {
    finishQuiz();
  }
}

async function finishQuiz() {
  clearInterval(timerInterval);
  clearTimeout(autoNextTimeout);

  document.getElementById("quizActiveCard").classList.add("hidden");
  document.getElementById("quizResultCard").classList.remove("hidden");

  const total = activeQuizList.length;
  const pct = Math.round((userScore / total) * 100);
  document.getElementById("resultScoreDisplay").innerText = `${userScore} / ${total} (${pct}%)`;

  const bonusBox = document.getElementById("bonusRewardAlert");
  const btnWrong = document.getElementById("btnRetakeWrong");
  const btnCert = document.getElementById("btnDownloadCert");

  if (btnWrong) btnWrong.classList.toggle("hidden", wrongQuestionsVault.length === 0);
  if (btnCert) btnCert.classList.toggle("hidden", pct < 60);

  let msg = "Sign up or sign in to save permanent score history!";

  if (currentUser) {
    if (pct === 100) {
      if (typeof confetti === "function") confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      msg = "🌟 PERFECT SCORE (100%)! போனஸ் சலுகை: 4 கூடுதல் தேர்வுகள் மற்றும் ஆசிரியர் பின்னூட்டம் திறக்கப்பட்டது!";
      bonusRetakesRemaining += 4;
      if (bonusBox) bonusBox.classList.remove("hidden");
    } else if (pct >= 80) {
      if (typeof confetti === "function") confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      msg = "🎉 சிறப்பான தேர்ச்சி!";
      if (bonusBox) bonusBox.classList.add("hidden");
    } else {
      msg = "பாடங்களை மீண்டும் படித்து உங்கள் மதிப்பெண்களை உயர்த்தவும்!";
      if (bonusBox) bonusBox.classList.add("hidden");
    }

    const challengeKey = `hms_challenge_${currentUser.id}`;
    let currentDays = parseInt(localStorage.getItem(challengeKey) || "0", 10);
    if (currentDays < 30) localStorage.setItem(challengeKey, currentDays + 1);
  } else {
    if (bonusBox) bonusBox.classList.add("hidden");
  }

  document.getElementById("resultFeedback").innerText = msg;

  const streamEl = document.getElementById("playStreamSelect");
  const streamVal = normalizeStream(streamEl ? streamEl.value : "ncert");

  const payload = {
    action: "saveScore", 
    userId: currentUser ? currentUser.id : "GUEST", 
    userName: currentUser ? currentUser.name : "Guest Student", 
    standard: document.getElementById("playStdSelect").value, 
    subject: document.getElementById("playSubSelect").value, 
    chapter: document.getElementById("playChapterSelect").value, 
    topic: document.getElementById("playTopicSelect").value, 
    score: userScore, 
    total: total,
    stream: streamVal
  };

  try { await callAppsScript(payload); } catch (e) { console.warn("Score save:", e); } 
  setTimeout(loadDailyWinners, 1500);
}

function retakeWrongOnly() {
  if (!wrongQuestionsVault || wrongQuestionsVault.length === 0) return alert("தவறான வினாக்கள் எதுவும் இல்லை!");
  activeQuizList = [...wrongQuestionsVault];
  wrongQuestionsVault = [];
  examReviewRecord = [];
  currentQIndex = 0;
  userScore = 0;

  document.getElementById("quizResultCard").classList.add("hidden");
  document.getElementById("quizActiveCard").classList.remove("hidden");
  renderCurrentQuestion();
}

function downloadCertificate() {
  const container = document.getElementById("certificatePrintContainer");
  if (!container) return;

  const total = activeQuizList.length || 1;
  const pct = Math.round((userScore / total) * 100);
  const studentName = (currentUser && currentUser.name) ? currentUser.name : "மதிப்புமிகு மாணவர்";
  const std = document.getElementById("playStdSelect") ? document.getElementById("playStdSelect").value : "5";
  const sub = document.getElementById("playSubSelect") ? document.getElementById("playSubSelect").value : "பொது மதிப்பீடு";
  const streamVal = normalizeStream(document.getElementById("playStreamSelect") ? document.getElementById("playStreamSelect").value : "ncert");
  const dateStr = new Date().toLocaleDateString('ta-IN');

  container.innerHTML = `
    <div id="certCaptureElement" style="width: 900px; padding: 40px; border: 10px solid #003366; background: #ffffff; text-align: center; font-family: 'Segoe UI', Arial, sans-serif; box-sizing: border-box; color: #000000; margin: 0 auto;">
      <div style="border: 2px solid #e65100; padding: 25px;">
        <h1 style="color: #003366; font-size: 30px; margin: 0 0 8px 0; font-weight: bold;"> HariMani School (${getStreamLabel(streamVal)}) </h1>
        <h3 style="color: #e65100; font-size: 18px; margin: 0 0 20px 0; text-transform: uppercase;">Certificate of Achievement</h3>
        <p style="font-size: 16px; color: #475569; margin: 15px 0;">இச்சான்றிதழ் பெருமையுடன் வழங்கப்படுகிறது</p>
        <h2 style="font-size: 28px; color: #0f172a; margin: 10px 0 20px 0; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; display: inline-block;">
          ${studentName}
        </h2>
        <p style="font-size: 16px; color: #334155; line-height: 1.8; margin: 15px 30px;">
          வகுப்பு <strong>${std}</strong>, பாடம் <strong>${sub}</strong> மதிப்பீட்டுத் தேர்வில் பங்குபெற்று 
          <strong>${userScore} / ${total} (${pct}%)</strong> மதிப்பெண்கள் பெற்று தேர்ச்சி அடைந்துள்ளார்.
        </p>
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; padding: 0 40px;">
          <div style="font-size: 15px; color: #334155;">நாள்: ${dateStr}</div>
          <div style="font-size: 16px; font-weight: bold; color: #003366; border-top: 2px solid #003366; padding-top: 5px;">HARIMANI PORTAL</div>
        </div>
      </div>
    </div>
  `;

  const captureEl = document.getElementById("certCaptureElement");
  const opt = {
    margin: [10, 10, 10, 10],
    filename: `${studentName.replace(/\s+/g, '_')}_Certificate.pdf`,
    image: { type: 'jpeg', quality: 1 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'pt', format: 'a4', orientation: 'landscape' }
  };

  html2pdf().set(opt).from(captureEl).save().then(() => { container.innerHTML = ""; });
}

async function loadLeaderboard() {
  const tbody = document.getElementById("leaderboardTbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">தரவரிசைப் பட்டியல் ஏற்றப்படுகிறது...</td></tr>`;

  const stdFilter = (document.getElementById("leaderboardStdFilter")?.value) || "all";
  const streamFilter = (document.getElementById("leaderboardStreamFilter")?.value) || "all";
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getLeaderboard&standard=${encodeURIComponent(stdFilter)}&stream=${encodeURIComponent(streamFilter)}`);
    const data = await res.json();
    if (data && data.success) {
      renderLeaderboardTable(data.leaderboard || []);
    } else {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">தரவுகள் கிடைக்கவில்லை.</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">பிழை: ${err.message}</td></tr>`;
  }
}

function renderLeaderboardTable(list) {
  const tbody = document.getElementById("leaderboardTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">இவ்வகுப்பில் இன்னும் தேர்வுகள் பதிவாகவில்லை.</td></tr>`;
    return;
  }

  const medals = ["🥇 1", "🥈 2", "🥉 3"];
  list.forEach((item, idx) => {
    const rankDisplay = medals[idx] || (idx + 1);
    tbody.innerHTML += `
      <tr>
        <td style="font-weight:bold; text-align:center;">${rankDisplay}</td>
        <td><strong>${item.userName}</strong> <small style="color:#64748b;">(${item.userId})</small></td>
        <td><span class="tag-pill">${getStreamLabel(item.stream)}</span> வகுப்பு ${item.standard}</td>
        <td>${item.testsCount} தேர்வுகள்</td>
        <td><strong>${item.totalScore} / ${item.totalPossible}</strong></td>
        <td><span class="badge badge-success">${item.percentage}%</span></td>
      </tr>
    `;
  });
}

function toggleExamReview() {
  const reviewArea = document.getElementById("quizReviewArea");
  if (!reviewArea) return;

  if (!reviewArea.classList.contains("hidden")) {
    reviewArea.classList.add("hidden");
    return;
  }

  const list = document.getElementById("reviewQuestionsList");
  list.innerHTML = "";

  examReviewRecord.forEach((rec, idx) => {
    const q = rec.question;
    const card = document.createElement("div");
    card.className = `review-item-card ${rec.isCorrect ? 'correct-border' : 'wrong-border'}`;
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <div style="font-weight:bold; font-size:1rem; margin-bottom:6px; flex:1;">
          ${idx + 1}. [${(q.type || 'mcq').toUpperCase()}] (${getStreamLabel(q.stream)}) ${q.question}
        </div>
        <button class="btn btn-outline-dark voice-btn" onclick="speakText('${q.question.replace(/'/g, "\\'")}')" title="கேள்வியை வாசி">🔊</button>
      </div>
      <div style="margin-bottom:8px;">
        <span class="badge ${rec.isCorrect ? 'badge-success' : 'badge-danger'}">${rec.isCorrect ? '✅ சரி' : '❌ தவறு'}</span>
      </div>
      <div style="font-size:0.9rem; margin-bottom:4px;">
        <strong>உங்கள் விடை:</strong> <span style="color:${rec.isCorrect ? 'var(--accent)' : 'var(--danger)'};">${rec.userChoice}</span>
      </div>
      <div style="font-size:0.9rem; margin-bottom:6px;">
        <strong>சரியான விடை:</strong> <span style="color:var(--accent); font-weight:600;">${rec.correctChoice}</span>
      </div>
      <div class="explanation-card" style="margin-top:8px;">
        <strong>📖 விளக்கம்:</strong> ${q.explanation || 'சரிபார்க்கப்பட்டது.'}
      </div>
    `;
    list.appendChild(card);
  });

  reviewArea.classList.remove("hidden");
  reviewArea.scrollIntoView({ behavior: 'smooth' });
}

async function submitTeacherFeedback() {
  if (!currentUser) return alert("Please login to send teacher feedback.");
  const msgInput = document.getElementById("teacherFeedbackMessage");
  const msg = msgInput.value.trim();
  if (!msg) return alert("தயவுசெய்து உங்கள் கருத்து அல்லது சந்தேகத்தை எழுதவும்.");

  const payload = {
    action: "sendTeacherFeedback", 
    userId: currentUser.id, 
    userName: currentUser.name, 
    standard: document.getElementById("playStdSelect").value, 
    subject: document.getElementById("playSubSelect").value, 
    score: userScore, 
    total: activeQuizList.length, 
    message: msg 
  };

  const res = await callAppsScript(payload);
  if (res && res.success) {
    alert("✅ உங்கள் சந்தேகம்/கருத்து ஆசிரியருக்கு வெற்றிகரமாக அனுப்பப்பட்டது!");
    msgInput.value = "";
  } else {
    alert("கருத்தை அனுப்புவதில் பிழை ஏற்பட்டது.");
  }
}

function toggleManualTypeInputs(type) {
  document.getElementById("wrapperMcqFields").classList.toggle("hidden", type !== "mcq");
  document.getElementById("wrapperTfFields").classList.toggle("hidden", type !== "tf");
  document.getElementById("wrapperFibFields").classList.toggle("hidden", type !== "fib");
  document.getElementById("wrapperMatchFields").classList.toggle("hidden", type !== "match");
}

async function publishManualQuestion() {
  if (!currentUser) return alert("Please sign in as Teacher or Principal.");

  const stream = normalizeStream(document.getElementById("authorStreamSelect").value);
  const type = document.getElementById("manualQType").value;
  const std = document.getElementById("authorStdSelect").value;
  const sub = document.getElementById("authorSubSelect").value;
  const chap = document.getElementById("authorChapterInput").value.trim() || "General";
  const topic = document.getElementById("authorTopicInput").value.trim() || "All";
  const qText = document.getElementById("manualQuestionText").value.trim();
  const explanation = (document.getElementById("manualExplanation")?.value || "").trim();

  if (!qText) return alert("Please enter the question statement.");

  let optA = "", optB = "", optC = "", optD = "", correctOpt = "";

  if (type === "mcq") {
    optA = document.getElementById("manualOptA").value.trim();
    optB = document.getElementById("manualOptB").value.trim();
    optC = document.getElementById("manualOptC").value.trim();
    optD = document.getElementById("manualOptD").value.trim();
    correctOpt = document.getElementById("manualCorrectOptMcq").value;
    if (!optA || !optB || !optC || !optD) return alert("Please fill all 4 options.");
  } else if (type === "tf") {
    correctOpt = document.getElementById("manualCorrectOptTf").value;
  } else if (type === "fib") {
    correctOpt = document.getElementById("manualCorrectOptFib").value.trim();
    if (!correctOpt) return alert("Please enter the correct blank answer.");
  } else if (type === "match") {
    optA = document.getElementById("matchPair1").value.trim();
    optB = document.getElementById("matchPair2").value.trim();
    optC = document.getElementById("matchPair3").value.trim();
    optD = document.getElementById("matchPair4").value.trim();
    correctOpt = "MATCH";
  }

  const payload = {
    action: "saveSingleQuestion", 
    userId: currentUser.id, 
    role: currentUser.role, 
    stream: stream,
    type: type, 
    standard: std, 
    subject: sub, 
    chapter: chap, 
    topic: topic, 
    question: qText, 
    optA, optB, optC, optD, 
    correctOpt: correctOpt, 
    explanation: explanation 
  };

  const data = await callAppsScript(payload);
  if (data && data.success) {
    alert("✅ Question successfully saved!");
    document.getElementById("manualQuestionText").value = "";
    if (document.getElementById("manualExplanation")) document.getElementById("manualExplanation").value = "";
    await loadPortalData();
  }
}

async function extractTextFromPDF(file) {
  if (typeof pdfjsLib === "undefined") throw new Error("PDF.js library is not loaded.");
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += ` [Page ${i}] ` + textContent.items.map(item => item.str).join(" ") + "\n";
  }
  return fullText;
}

async function callAppsScript(payload) {
  const res = await fetch(SCRIPT_URL, {
    method: "POST", 
    headers: { "Content-Type": "text/plain;charset=utf-8" }, 
    body: JSON.stringify(payload) 
  });
  return await res.json();
}

async function generateViaAI() {
  const fileInput = document.getElementById("aiFileInput");
  const file = fileInput.files[0];
  if (!file) return alert("Please select a PDF or Image file first.");

  const countInput = document.getElementById("aiQuestionCount");
  let requestedTotal = parseInt(countInput.value, 10) || 10;
  if (requestedTotal > 20) requestedTotal = 20;

  const btnExtract = document.getElementById("btnExtractAi");
  const progressArea = document.getElementById("aiBatchProgressArea");
  const statusText = document.getElementById("aiBatchStatusText");
  const progressPct = document.getElementById("aiBatchProgressPct");
  const progressBar = document.getElementById("aiBatchProgressBar");
  const previewArea = document.getElementById("aiPreviewArea");

  btnExtract.disabled = true;
  progressArea.classList.remove("hidden");
  previewArea.classList.add("hidden");
  extractedAiBatch = [];

  const context = {
    stream: normalizeStream(document.getElementById("authorStreamSelect").value),
    standard: document.getElementById("authorStdSelect").value,
    subject: document.getElementById("authorSubSelect").value,
    chapter: document.getElementById("authorChapterInput").value.trim() || "Unit 1",
    topic: document.getElementById("authorTopicInput").value.trim() || "General" 
  };

  try {
    let payloadData = "";
    let isText = false;

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      statusText.innerText = "Extracting text from PDF...";
      payloadData = await extractTextFromPDF(file);
      isText = true;
    } else {
      statusText.innerText = "Reading image data...";
      payloadData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      isText = false;
    }

    statusText.innerText = `Generating ${requestedTotal} multi-category questions via AI...`;
    progressPct.innerText = "50%";
    progressBar.style.width = "50%";

    const data = await callAppsScript({
      action: "parseDocument", 
      fileData: payloadData, 
      isText: isText, 
      count: requestedTotal, 
      contextInfo: context 
    });

    progressBar.style.width = "100%";
    progressPct.innerText = "100%";
    btnExtract.disabled = false;

    if (data && data.success && Array.isArray(data.questions) && data.questions.length > 0) {
      statusText.innerText = `Generated ${data.questions.length} questions successfully!`;
      extractedAiBatch = data.questions;
      document.getElementById("aiTotalCountBadge").innerText = extractedAiBatch.length;
      renderAiPreview(extractedAiBatch);
      previewArea.classList.remove("hidden");
    } else {
      progressArea.classList.add("hidden");
      alert("Error generating questions:\n" + (data ? data.error : "Unknown error"));
    }
  } catch (err) {
    btnExtract.disabled = false;
    progressArea.classList.add("hidden");
    alert("Extraction error: " + err.message);
  }
}

function renderAiPreview(questions) {
  const container = document.getElementById("aiPreviewList");
  container.innerHTML = "";
  questions.forEach((q, idx) => {
    const item = document.createElement("div");
    item.style.padding = "8px 0";
    item.style.borderBottom = "1px solid #e9ecef";
    item.innerHTML = `
      <div style="font-weight:600;">${idx + 1}. [${(q.type || 'mcq').toUpperCase()}] ${q.question}</div>
      ${q.optA ? `<div style="font-size:0.85rem; color:#555;">A) ${q.optA} | B) ${q.optB} | C) ${q.optC} | D) ${q.optD}</div>` : ''}
      <div style="font-size:0.85rem; color:var(--accent); font-weight:bold;">Correct: ${q.correctOpt}</div>
      <div style="font-size:0.82rem; color:#084298; margin-top:3px;"><strong>Explanation:</strong> ${q.explanation || 'N/A'}</div>
    `;
    container.appendChild(item);
  });
}

async function publishAiBatch() {
  const streamVal = normalizeStream(document.getElementById("authorStreamSelect").value);
  const payload = {
    action: "saveBatchQuestions", 
    userId: currentUser.id, 
    role: currentUser.role, 
    stream: streamVal,
    standard: document.getElementById("authorStdSelect").value, 
    subject: document.getElementById("authorSubSelect").value, 
    chapter: document.getElementById("authorChapterInput").value.trim() || "Unit 1", 
    topic: document.getElementById("authorTopicInput").value.trim() || "General", 
    questions: extractedAiBatch 
  };

  const data = await callAppsScript(payload);
  if (data && data.success) {
    alert(`✅ Published ${data.count} questions to Question Bank!`);
    document.getElementById("aiPreviewArea").classList.add("hidden");
    document.getElementById("aiBatchProgressArea").classList.add("hidden");
    await loadPortalData();
  }
}

function renderManageTable() {
  const tbody = document.getElementById("manageTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const search = document.getElementById("manageSearchInput") ? document.getElementById("manageSearchInput").value.toLowerCase().trim() : "";
  const rawStreamFilter = document.getElementById("manageStreamFilter") ? document.getElementById("manageStreamFilter").value : "";
  const streamFilter = rawStreamFilter ? normalizeStream(rawStreamFilter) : "";
  const std = document.getElementById("manageStdFilter") ? document.getElementById("manageStdFilter").value : "";
  const sub = document.getElementById("manageSubFilter") ? document.getElementById("manageSubFilter").value.toLowerCase() : "";

  const isPrincipal = currentUser && (currentUser.role === "principal");
  const myId = currentUser ? currentUser.id.toLowerCase() : "";

  const filtered = masterQuestions.filter(q => {
    const isOwner = (q.creatorId && q.creatorId.toLowerCase() === myId);
    if (!isPrincipal && !isOwner) return false;

    const mStream = !streamFilter || normalizeStream(q.stream) === streamFilter;
    const fullTextSearch = `${q.question || ""} ${q.optA || ""} ${q.optB || ""} ${q.optC || ""} ${q.optD || ""} ${q.explanation || ""}`.toLowerCase();
    const mSearch = !search || fullTextSearch.includes(search);
    const mStd = !std || q.standard === std;
    const mSub = !sub || (q.subject || "").toLowerCase() === sub;
    return mStream && mSearch && mStd && mSub;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">No questions found matching your search.</td></tr>`;
    return;
  }

  const displayLimit = 100;
  const paginatedList = filtered.slice(0, displayLimit);

  let htmlContent = "";
  if (filtered.length > displayLimit) {
    htmlContent += `<tr><td colspan="7" style="text-align:center; background:#fffbeb; color:#92400e; font-size:0.85rem; padding:8px;">Showing first ${displayLimit} of ${filtered.length} matching questions. Use filters or search to narrow down results.</td></tr>`;
  }

  paginatedList.forEach(q => {
    htmlContent += `
      <tr>
        <td><span class="tag-pill">${getStreamLabel(q.stream)}</span><br><strong>Class ${q.standard || '5'}</strong></td>
        <td><span class="badge" style="background:#003366; color:#fff;">${(q.type || 'mcq').toUpperCase()}</span></td>
        <td>${q.subject || 'General'}</td>
        <td><small><strong>${q.chapter || 'General'}</strong><br>${q.topic || 'All'}</small></td>
        <td>
          <div style="font-weight:600;">${q.question || ''}</div>
          ${q.optA ? `<small>A) ${q.optA} | B) ${q.optB} | C) ${q.optC} | D) ${q.optD}</small><br>` : ''}
          <small style="color:var(--accent); font-weight:bold;">Correct: ${q.correctOpt || ''}</small>
        </td>
        <td><code>${q.creatorId || 'System'}</code></td>
        <td style="white-space:nowrap;">
          <button class="btn btn-outline-dark" style="padding:4px 8px; font-size:0.8rem; margin-right:4px;" onclick="openEditQuestionModal('${q.id}')">✏️ Edit</button>
          <button class="btn btn-danger" style="padding:4px 8px; font-size:0.8rem;" onclick="deleteQuestion('${q.id}')">🗑️ Delete</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = htmlContent;
}

function openEditQuestionModal(qId) {
  const q = masterQuestions.find(item => item.id === qId);
  if (!q) return alert("Question not found.");

  document.getElementById("editQId").value = q.id;
  document.getElementById("editQText").value = q.question || "";
  document.getElementById("editOptA").value = q.optA || "";
  document.getElementById("editOptB").value = q.optB || "";
  document.getElementById("editOptC").value = q.optC || "";
  document.getElementById("editOptD").value = q.optD || "";
  document.getElementById("editCorrectOpt").value = q.correctOpt || "";
  document.getElementById("editExplanation").value = q.explanation || "";

  openModal("modalEditQuestion");
}

async function saveEditedQuestion() {
  const qId = document.getElementById("editQId").value;
  const updatedQ = {
    action: "saveSingleQuestion", 
    userId: currentUser.id,
    role: currentUser.role,
    questionId: qId,
    question: document.getElementById("editQText").value.trim(),
    optA: document.getElementById("editOptA").value.trim(),
    optB: document.getElementById("editOptB").value.trim(),
    optC: document.getElementById("editOptC").value.trim(),
    optD: document.getElementById("editOptD").value.trim(),
    correctOpt: document.getElementById("editCorrectOpt").value.trim(),
    explanation: document.getElementById("editExplanation").value.trim()
  };

  await callAppsScript({ action: "deleteQuestion", questionId: qId, userId: currentUser.id });
  const res = await callAppsScript(updatedQ);

  if (res && res.success) {
    alert("✅ Question successfully updated!");
    closeModal("modalEditQuestion");
    await loadPortalData();
    renderManageTable();
  } else {
    alert("Failed to update question.");
  }
}

function generatePrintablePaper(count) {
  const std = document.getElementById("manageStdFilter").value || "All Classes";
  const sub = document.getElementById("manageSubFilter").value || "General Assessment";
  const streamFilter = normalizeStream(document.getElementById("manageStreamFilter").value || "ncert");

  let pool = [...masterQuestions];
  pool = pool.filter(q => normalizeStream(q.stream) === streamFilter);
  if (std !== "All Classes") pool = pool.filter(q => q.standard === std);
  if (sub !== "General Assessment") pool = pool.filter(q => q.subject.toLowerCase() === sub.toLowerCase());

  if (pool.length === 0) return alert("No questions available for this filter to generate a test paper.");

  pool.sort(() => Math.random() - 0.5);
  const selected = pool.slice(0, Math.min(count, pool.length));

  const printArea = document.getElementById("printContainer");
  printArea.innerHTML = `
    <div class="print-header">
      <h2>HARI MANDIR HIGHER SECONDARY SCHOOL (${getStreamLabel(streamFilter)})</h2>
      <h3>Official Examination Assessment Question Paper</h3>
      <div style="display:flex; justify-content:space-between; margin-top:10px; font-weight:bold; font-size:0.95rem;">
        <span>Stream: ${getStreamLabel(streamFilter)}</span>
        <span>Class: ${std}</span>
        <span>Subject: ${sub}</span>
        <span>Max Marks: ${selected.length}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-top:10px; border-bottom:2px solid #000; padding-bottom:8px; font-size:0.9rem;">
        <span>Student Name: __________________________</span>
        <span>Roll No: ____________</span>
        <span>Date: ____________</span>
      </div>
    </div>

    <div class="print-questions-section" style="margin-top:20px;">
      ${selected.map((q, idx) => {
        const type = (q.type || 'mcq').toLowerCase();
        let bodyHtml = "";
        if (type === "mcq") {
          bodyHtml = `
            <div style="display:grid; grid-template-columns:1fr 1fr; margin-top:4px; font-size:0.9rem; padding-left:15px;">
              <div>(A) ${q.optA}</div><div>(B) ${q.optB}</div>
              <div>(C) ${q.optC}</div><div>(D) ${q.optD}</div>
            </div>`;
        } else if (type === "tf") {
          bodyHtml = `<div style="padding-left:15px; font-size:0.9rem; margin-top:4px;">[ &nbsp; ] True &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] False</div>`;
        } else if (type === "fib") {
          bodyHtml = `<div style="padding-left:15px; font-size:0.9rem; margin-top:4px;">Answer: ______________________________</div>`;
        } else if (type === "match") {
          const pairs = [q.optA, q.optB, q.optC, q.optD].filter(Boolean).map(p => p.split(":"));
          bodyHtml = `
            <div style="padding-left:15px; font-size:0.9rem; margin-top:4px;">
              ${pairs.map(p => `<div>• ${p[0] || ''} &nbsp; ----------------- &nbsp; ${p[1] || ''}</div>`).join("")}
            </div>`;
        }
        return `
          <div style="margin-bottom:14px; page-break-inside:avoid;">
            <div style="font-weight:600;">${idx + 1}. [${type.toUpperCase()}] ${q.question}</div>
            ${bodyHtml}
          </div>
        `;
      }).join("")}
    </div>

    <div style="page-break-before:always; margin-top:30px;">
      <h3 style="text-align:center; border-bottom:1px solid #000; padding-bottom:5px;">CONFIDENTIAL TEACHER ANSWER KEY</h3>
      <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.85rem;" border="1">
        <thead>
          <tr style="background:#eee;">
            <th style="padding:6px; width:8%;">Q.No</th>
            <th style="padding:6px; width:12%;">Type</th>
            <th style="padding:6px; width:25%;">Correct Answer</th>
            <th style="padding:6px;">Rationale</th>
          </tr>
        </thead>
        <tbody>
          ${selected.map((q, idx) => `
            <tr>
              <td style="padding:5px; text-align:center;">${idx + 1}</td>
              <td style="padding:5px; text-align:center;">${(q.type || 'mcq').toUpperCase()}</td>
              <td style="padding:5px; font-weight:bold;">${q.correctOpt}</td>
              <td style="padding:5px;">${q.explanation || 'Verified.'}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  window.print();
}

async function deleteQuestion(id) {
  if (!confirm("Are you sure you want to remove this question?")) return;
  const data = await callAppsScript({ action: "deleteQuestion", questionId: id, userId: currentUser.id });
  if (data && data.success) {
    alert("Question deleted.");
    await loadPortalData();
    renderManageTable();
  } else {
    alert(data ? data.error : "Failed to delete question");
  }
}

async function loadUserReports() {
  if (!currentUser) return;
  const tbody = document.getElementById("userScoresTbody");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Loading scores...</td></tr>`;

  try {
    const res = await fetch(`${SCRIPT_URL}?action=getUserScores&userId=${encodeURIComponent(currentUser.id)}`);
    const data = await res.json();
    if (data && data.success) {
      masterUserScores = data.scores || [];
      renderUserBadges(masterUserScores);
      filterUserReports();
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Error: ${e.message}</td></tr>`;
  }
}

function renderUserBadges(scores) {
  const container = document.getElementById("badgesContainer");
  if (!container) return;
  container.innerHTML = "";

  if (!scores || scores.length === 0) {
    container.innerHTML = `<span style="font-size:0.85rem; color:#777;">Attend exams daily to earn achievement badges!</span>`;
    return;
  }

  const uniqueDates = [...new Set(scores.map(s => (s.date || '').split("T")[0]))].sort().reverse();
  let currentStreak = 0;
  if (uniqueDates.length > 0) {
    let checkDate = new Date();
    for (let d of uniqueDates) {
      const dt = new Date(d);
      const diffDays = Math.floor((checkDate - dt) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) { currentStreak++; checkDate = dt; } else { break; }
    }
  }

  const streakDisplay = document.getElementById("repStatStreak");
  if (streakDisplay) streakDisplay.innerText = `${currentStreak} Days`;

  const badges = [];
  if (currentStreak >= 3) badges.push({ icon: "🔥", title: "3-Day Streak", desc: "Practiced 3 days in a row!" });
  if (currentStreak >= 7) badges.push({ icon: "⚡", title: "7-Day Streak", desc: "Super consistent learner!" });

  if (badges.length === 0) {
    container.innerHTML = `<span style="font-size:0.85rem; color:#666;">Keep practicing! Badges unlock at 3-Day streak.</span>`;
  } else {
    badges.forEach(b => {
      const el = document.createElement("div");
      el.className = "badge-card";
      el.innerHTML = `
        <div style="font-size:1.6rem;">${b.icon}</div>
        <div style="font-weight:bold; font-size:0.85rem; margin-top:4px;">${b.title}</div>
        <div style="font-size:0.75rem; color:#666;">${b.desc}</div>
      `;
      container.appendChild(el);
    });
  }
}

function filterUserReports() {
  const from = document.getElementById("repFromDate").value;
  const to = document.getElementById("repToDate").value;
  const std = document.getElementById("repStdFilter").value;
  const sub = document.getElementById("repSubFilter").value.toLowerCase();

  const filtered = masterUserScores.filter(s => {
    let sDate = s.date;
    if (s.date && s.date.includes("T")) sDate = s.date.split("T")[0];

    const mFrom = !from || sDate >= from;
    const mTo = !to || sDate <= to;
    const mStd = !std || s.standard === std;
    const mSub = !sub || s.subject.toLowerCase() === sub;
    return mFrom && mTo && mStd && mSub;
  });

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  const tbody = document.getElementById("userScoresTbody");
  tbody.innerHTML = "";

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No scores found.</td></tr>`;
    document.getElementById("repStatTotal").innerText = "0";
    document.getElementById("repStatAvg").innerText = "0%";
    return;
  }

  let totalPct = 0;
  filtered.forEach(s => {
    const pct = Math.round((Number(s.score) / Number(s.total)) * 100);
    totalPct += pct;
    tbody.innerHTML += `
      <tr>
        <td>${s.date}</td>
        <td><span class="tag-pill">${getStreamLabel(s.stream)}</span></td>
        <td>Class ${s.standard}</td>
        <td>${s.subject}</td>
        <td>${s.score} / ${s.total}</td>
        <td><strong>${pct}%</strong></td>
      </tr>
    `;
  });

  document.getElementById("repStatTotal").innerText = filtered.length;
  document.getElementById("repStatAvg").innerText = `${Math.round(totalPct / filtered.length)}%`;
}

async function loadTeacherStudentScores() {
  if (!currentUser) return;
  const tbody = document.getElementById("teacherStudentScoresTbody");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Loading assigned class scores...</td></tr>`;

  try {
    const res = await fetch(`${SCRIPT_URL}?action=getTeacherStudentScores&userId=${encodeURIComponent(currentUser.id)}`);
    const data = await res.json();
    if (data && data.success) {
      teacherStudentScores = data.scores || [];
      filterTeacherStudentScores();
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center;">Error: ${e.message}</td></tr>`;
  }
}

function filterTeacherStudentScores() {
  const search = document.getElementById("tchRepSearchStudent").value.toLowerCase();
  const std = document.getElementById("tchRepStdFilter").value;
  const sub = document.getElementById("tchRepSubFilter").value.toLowerCase();

  const tbody = document.getElementById("teacherStudentScoresTbody");
  tbody.innerHTML = "";

  const filtered = (teacherStudentScores || []).filter(s => {
    const mStudent = !search || s.userId.toLowerCase().includes(search) || s.userName.toLowerCase().includes(search);
    const mStd = !std || s.standard === std;
    const mSub = !sub || s.subject.toLowerCase() === sub;
    return mStudent && mStd && mSub;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No student performance records found.</td></tr>`;
    return;
  }

  filtered.forEach(s => {
    const pct = Math.round((Number(s.score) / Number(s.total)) * 100);
    tbody.innerHTML += `
      <tr>
        <td><strong>${s.userId}</strong></td>
        <td>${s.userName}</td>
        <td><span class="tag-pill">${getStreamLabel(s.stream)}</span></td>
        <td>Class ${s.standard}</td>
        <td>${s.subject}</td>
        <td><strong>${s.score} / ${s.total} (${pct}%)</strong></td>
        <td>${s.date}</td>
      </tr>
    `;
  });
}

async function deleteTeacher(teacherId) {
  if (!confirm(`நிச்சயமாக ஆசிரியர் ${teacherId}-ஐ நீக்க விரும்புகிறீர்களா?`)) return;
  const payload = { action: "deleteTeacher", principalId: currentUser ? currentUser.id : "PRINCIPAL", targetTeacherId: teacherId };
  try {
    const data = await callAppsScript(payload);
    if (data && data.success) { alert(`✅ ஆசிரியர் ${teacherId} வெற்றிகரமாக நீக்கப்பட்டார்!`); loadPrincipalDashboard(); }
    else { alert("பிழை: " + (data ? data.error : "நீக்க முடியவில்லை")); }
  } catch (err) { alert("இணைப்புப் பிழை: " + err.message); }
}

async function deleteStudent(studentId) {
  if (!confirm(`நிச்சயமாக மாணவர் ${studentId}-ஐ நீக்க விரும்புகிறீர்களா?`)) return;
  const payload = { action: "deleteStudent", principalId: currentUser ? currentUser.id : "PRINCIPAL", targetStudentId: studentId };
  try {
    const data = await callAppsScript(payload);
    if (data && data.success) { alert(`✅ மாணவர் ${studentId} வெற்றிகரமாக நீக்கப்பட்டார்!`); loadPrincipalDashboard(); }
    else { alert("பிழை: " + (data ? data.error : "நீக்க முடியவில்லை")); }
  } catch (err) { alert("இணைப்புப் பிழை: " + err.message); }
}

async function principalCreateTeacher() {
  const id = document.getElementById("newTeacherId").value.trim();
  const name = document.getElementById("newTeacherName").value.trim();
  const stream = normalizeStream(document.getElementById("newTeacherStream").value);
  const pass = document.getElementById("newTeacherPass").value.trim();

  if (!id || !name || !pass) return alert("Enter Teacher ID, Name, and Password.");

  const payload = {
    action: "createTeacher", 
    principalId: currentUser.id, 
    teacherId: id, 
    teacherName: name, 
    password: pass, 
    studentStream: stream,
    standards: ["5"], 
    subjects: ["Science"] 
  };

  const data = await callAppsScript(payload);
  if (data && data.success) {
    alert(`Teacher ${name} created successfully!`);
    document.getElementById("newTeacherId").value = "";
    document.getElementById("newTeacherName").value = "";
    document.getElementById("newTeacherPass").value = "";
    loadPrincipalDashboard();
  } else {
    alert("Error: " + (data ? data.error : "Could not create teacher"));
  }
}

function switchPrincipalSubView(viewName, btn) {
  document.querySelectorAll(".pr-subtab-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  document.getElementById("prViewTeachers").classList.toggle("hidden", viewName !== 'teachers');
  document.getElementById("prViewStudents").classList.toggle("hidden", viewName !== 'students');
  document.getElementById("prViewAnalytics").classList.toggle("hidden", viewName !== 'analytics');
}

async function loadPrincipalDashboard() {
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getPrincipalDashboard&userId=${encodeURIComponent(currentUser.id)}`);
    const data = await res.json();
    if (data && data.success) {
      principalDashboardData = data;

      document.getElementById("prStatTeacherCount").innerText = (data.teachers || []).length;
      document.getElementById("prStatStudentCount").innerText = (data.students || []).length;
      document.getElementById("prStatAssessmentCount").innerText = (data.scores || []).length;

      renderPrincipalTeacherTable();
      renderPrincipalStudentTable();
      filterPrincipalScores();
    }
  } catch (err) {
    console.warn("Failed to load principal metrics:", err);
  }
}

function renderPrincipalTeacherTable() {
  const tbody = document.getElementById("principalTeacherTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const search = (document.getElementById("prTeacherSearchInput")?.value || "").toLowerCase().trim();
  const teachers = (principalDashboardData.teachers || []).filter(t => {
    return !search || t.name.toLowerCase().includes(search) || t.id.toLowerCase().includes(search);
  });

  if (teachers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">No matching teachers found.</td></tr>`;
    return;
  }

  teachers.forEach(t => {
    const stdTags = (t.standards && t.standards.length > 0)
      ? t.standards.map(s => `<span class="tag-pill">Class ${s}</span>`).join(" ")
      : `<span style="color:#94a3b8; font-size:0.8rem;">None assigned</span>`;

    const subTags = (t.subjects && t.subjects.length > 0)
      ? t.subjects.map(s => `<span class="tag-pill" style="background:#e0f2fe; color:#0369a1;">${s}</span>`).join(" ")
      : `<span style="color:#94a3b8; font-size:0.8rem;">None assigned</span>`;

    tbody.innerHTML += `
      <tr>
        <td><code>${t.id}</code></td>
        <td><strong>${t.name}</strong></td>
        <td><span class="tag-pill" style="background:#fef3c7; color:#b45309;">${getStreamLabel(t.studentStream)}</span></td>
        <td>${stdTags}</td>
        <td>${subTags}</td>
        <td style="text-align:right;">
          <button class="btn btn-outline-dark" style="padding:4px 10px; font-size:0.8rem;" onclick="openEditTeacherModal('${t.id}')">⚙️ Configure</button>
          <button class="btn btn-danger" style="padding:4px 8px; font-size:0.8rem; margin-left:4px;" onclick="deleteTeacher('${t.id}')">🗑️</button>
        </td>
      </tr>
    `;
  });
}

function openEditTeacherModal(teacherId) {
  const teacher = (principalDashboardData.teachers || []).find(t => t.id === teacherId);
  if (!teacher) return;

  document.getElementById("editTeacherTargetId").value = teacherId;
  document.getElementById("editTeacherModalTitle").innerText = `Configure Access: ${teacher.name}`;
  document.getElementById("editTeacherModalSub").innerText = `Staff Code: ${teacher.id}`;
  document.getElementById("editTeacherStream").value = normalizeStream(teacher.studentStream || "ncert");

  const stdContainer = document.getElementById("editTeacherStdContainer");
  stdContainer.innerHTML = GLOBAL_STANDARDS.map(std => {
    const isChecked = teacher.standards.includes(std);
    return `<div class="chip-item ${isChecked ? 'active' : ''}" onclick="toggleChip(this)" data-val="${std}"><span>${isChecked ? '✓' : '+'}</span> Class ${std}</div>`;
  }).join("");

  const subContainer = document.getElementById("editTeacherSubContainer");
  subContainer.innerHTML = GLOBAL_SUBJECTS.map(sub => {
    const isChecked = teacher.subjects.includes(sub);
    return `<div class="chip-item ${isChecked ? 'active' : ''}" onclick="toggleChip(this)" data-val="${sub}"><span>${isChecked ? '✓' : '+'}</span> ${sub}</div>`;
  }).join("");

  openModal("modalEditTeacherScope");
}

function toggleChip(el) {
  el.classList.toggle("active");
  const sign = el.querySelector("span");
  if (sign) sign.innerText = el.classList.contains("active") ? "✓" : "+";
}

async function confirmSaveTeacherPermissions() {
  const teacherId = document.getElementById("editTeacherTargetId").value;
  const teacher = (principalDashboardData.teachers || []).find(t => t.id === teacherId);
  if (!teacher) return;

  const streamVal = normalizeStream(document.getElementById("editTeacherStream").value);
  const selectedStds = Array.from(document.querySelectorAll("#editTeacherStdContainer .chip-item.active")).map(c => c.getAttribute("data-val"));
  const selectedSubs = Array.from(document.querySelectorAll("#editTeacherSubContainer .chip-item.active")).map(c => c.getAttribute("data-val"));

  teacher.studentStream = streamVal;
  teacher.standards = selectedStds;
  teacher.subjects = selectedSubs;

  const payload = {
    action: "updateTeacherPermissions",
    principalId: currentUser.id,
    targetTeacherId: teacherId,
    studentStream: streamVal,
    standards: selectedStds,
    subjects: selectedSubs
  };

  const data = await callAppsScript(payload);
  if (data && data.success) {
    closeModal("modalEditTeacherScope");
    renderPrincipalTeacherTable();
    alert(`✅ Permissions updated for ${teacher.name}!`);
  } else {
    alert("Error: " + (data ? data.error : "Failed"));
  }
}

function renderPrincipalStudentTable() {
  const tbody = document.getElementById("principalStudentTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const search = (document.getElementById("prStudentSearchInput")?.value || "").toLowerCase().trim();
  const roleFilter = document.getElementById("prStudentRoleFilter")?.value || "all";

  const students = (principalDashboardData.students || []).filter(s => {
    const mSearch = !search || s.name.toLowerCase().includes(search) || s.id.toLowerCase().includes(search);
    const mRole = (roleFilter === "all") || (s.role === roleFilter);
    return mSearch && mRole;
  });

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">No enrolled students found.</td></tr>`;
    return;
  }

  students.forEach(s => {
    const stdTags = (s.standards && s.standards.length > 0)
      ? s.standards.map(std => `<span class="tag-pill">Class ${std}</span>`).join(" ")
      : `<span style="color:#94a3b8; font-size:0.8rem;">Unassigned</span>`;

    tbody.innerHTML += `
      <tr>
        <td><code>${s.id}</code></td>
        <td><strong>${s.name}</strong></td>
        <td><span class="tag-pill" style="background:#e0f2fe; color:#0369a1;">${getStreamLabel(s.studentStream)}</span></td>
        <td><span class="badge" style="background:${s.role === 'aspirant' ? '#f59e0b' : '#0284c7'}; color:#fff;">${s.role.toUpperCase()}</span></td>
        <td>${stdTags}</td>
        <td style="text-align:right;">
          <button class="btn btn-outline-dark" style="padding:4px 10px; font-size:0.8rem;" onclick="openEditStudentModal('${s.id}')">✏️ Edit</button>
          <button class="btn btn-danger" style="padding:4px 8px; font-size:0.8rem; margin-left:4px;" onclick="deleteStudent('${s.id}')">🗑️</button>
        </td>
      </tr>
    `;
  });
}

function openEditStudentModal(studentId) {
  const student = (principalDashboardData.students || []).find(s => s.id === studentId);
  if (!student) return;

  document.getElementById("editStudentTargetId").value = studentId;
  document.getElementById("editStudentModalTitle").innerText = `Enrollment: ${student.name}`;
  document.getElementById("editStudentModalSub").innerText = `Roll/ID: ${student.id} (${student.role.toUpperCase()})`;
  document.getElementById("editStudentStream").value = normalizeStream(student.studentStream || "ncert");

  const stdContainer = document.getElementById("editStudentStdContainer");
  stdContainer.innerHTML = GLOBAL_STANDARDS.map(std => {
    const isChecked = student.standards.includes(std);
    return `<div class="chip-item ${isChecked ? 'active' : ''}" onclick="toggleChip(this)" data-val="${std}"><span>${isChecked ? '✓' : '+'}</span> Class ${std}</div>`;
  }).join("");

  openModal("modalEditStudentScope");
}

async function confirmSaveStudentPermissions() {
  const studentId = document.getElementById("editStudentTargetId").value;
  const student = (principalDashboardData.students || []).find(s => s.id === studentId);
  if (!student) return;

  const streamVal = normalizeStream(document.getElementById("editStudentStream").value);
  const selectedStds = Array.from(document.querySelectorAll("#editStudentStdContainer .chip-item.active")).map(c => c.getAttribute("data-val"));
  student.studentStream = streamVal;
  student.standards = selectedStds;

  const payload = {
    action: "updateStudentPermissions",
    principalId: currentUser.id,
    targetStudentId: studentId,
    studentStream: streamVal,
    standards: selectedStds
  };

  const data = await callAppsScript(payload);
  if (data && data.success) {
    closeModal("modalEditStudentScope");
    renderPrincipalStudentTable();
    alert(`✅ Enrollment updated for ${student.name}!`);
  } else {
    alert("Error: " + (data ? data.error : "Failed"));
  }
}

function filterPrincipalScores() {
  const search = document.getElementById("prFilterStudent") ? document.getElementById("prFilterStudent").value.toLowerCase().trim() : "";
  const streamFilter = document.getElementById("prFilterStream") ? document.getElementById("prFilterStream").value.toLowerCase().trim() : "";
  const stdFilter = document.getElementById("prFilterStd") ? document.getElementById("prFilterStd").value.toLowerCase().trim() : "";
  const subFilter = document.getElementById("prFilterSub") ? document.getElementById("prFilterSub").value.toLowerCase().trim() : "";

  const tbody = document.getElementById("principalScoresTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const rawScores = principalDashboardData.scores || [];

  const filtered = rawScores.filter(s => {
    const userId = (s.userId || "").toString().toLowerCase();
    const userName = (s.userName || "").toString().toLowerCase();
    const mStudent = !search || userId.includes(search) || userName.includes(search);

    const recordStream = normalizeStream(s.stream);
    const mStream = !streamFilter || recordStream === streamFilter;

    const recordStd = (s.standard || "").toString().toLowerCase().replace(/class/gi, "").trim();
    const filterStd = stdFilter.replace(/class/gi, "").trim();
    const mStd = !filterStd || recordStd === filterStd;

    const recordSub = (s.subject || "").toString().toLowerCase().trim();
    const mSub = !subFilter || recordSub.includes(subFilter) || subFilter.includes(recordSub);

    return mStudent && mStream && mStd && mSub;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">No matching score records found.</td></tr>`;
    return;
  }

  filtered.forEach(s => {
    const scoreVal = Number(s.score) || 0;
    const totalVal = Number(s.total) || 1;
    const pct = Math.round((scoreVal / totalVal) * 100);
    const badgeColor = pct >= 80 ? 'badge-success' : pct >= 50 ? 'badge-pill' : 'badge-danger';
    const streamBadge = getStreamLabel(s.stream);

    tbody.innerHTML += `
      <tr>
        <td><strong>${s.userName || 'Student'}</strong><br><small style="color:#64748b;">(${s.userId || 'ID'})</small></td>
        <td><span class="tag-pill">${streamBadge}</span></td>
        <td>Class ${s.standard || '5'}</td>
        <td>${s.subject || 'General'}</td>
        <td><strong>${scoreVal} / ${totalVal}</strong></td>
        <td><span class="badge ${badgeColor}">${pct}%</span></td>
        <td><small>${s.date || ''}</small></td>
      </tr>
    `;
  });
}

function switchCreateMethod(method) {
  const btnManual = document.getElementById("btnMethodManual");
  const btnAi = document.getElementById("btnMethodAi");
  const btnCsv = document.getElementById("btnMethodCsv");

  if (btnManual) btnManual.className = (method === 'manual') ? 'btn btn-primary flex-1' : 'btn btn-outline-dark flex-1';
  if (btnAi) btnAi.className = (method === 'ai') ? 'btn btn-secondary flex-1' : 'btn btn-outline-dark flex-1';
  if (btnCsv) btnCsv.className = (method === 'csv') ? 'btn btn-primary flex-1' : 'btn btn-outline-dark flex-1';

  document.getElementById("sectionManualCreate").classList.toggle("hidden", method !== 'manual');
  document.getElementById("sectionAiCreate").classList.toggle("hidden", method !== 'ai');
  document.getElementById("sectionCsvCreate").classList.toggle("hidden", method !== 'csv');

  if (method === 'csv' && typeof updateAiPromptPreview === "function") updateAiPromptPreview();
}

function updateAiPromptPreview() {
  const streamSelect = document.getElementById("authorStreamSelect");
  const stdSelect = document.getElementById("authorStdSelect");
  const subSelect = document.getElementById("authorSubSelect");
  const chapInput = document.getElementById("authorChapterInput");
  const topicInput = document.getElementById("authorTopicInput");
  const promptBox = document.getElementById("aiStudioPromptTextarea");
  if (!promptBox) return;

  const stream = typeof normalizeStream === "function" 
    ? normalizeStream(streamSelect ? streamSelect.value : "ncert") 
    : (streamSelect ? streamSelect.value : "ncert");
    
  const streamLabel = typeof getStreamLabel === "function" 
    ? getStreamLabel(stream) 
    : (stream === "stateboard" ? "STATEBOARD (METRIC)" : "NCERT");

  const std = stdSelect && stdSelect.value ? stdSelect.value : "10";
  const sub = subSelect && subSelect.value ? subSelect.value : "Science";
  const chap = chapInput && chapInput.value.trim() ? chapInput.value.trim() : "[Chapter Title]";
  const topic = topicInput && topicInput.value.trim() ? topicInput.value.trim() : "[Topic]";

  promptBox.value = `You are an examination question author for HariMani School (${streamLabel}).
Your task is to analyze the attached textbook content book-wide and generate exactly 100 balanced assessment questions for each chapter found in the text.
Process every chapter sequentially from start to finish. For each chapter, generate the complete set of 100 questions strictly following the breakdown and formatting rules below.

QUESTION BREAKDOWN (EXACTLY 100 PER CHAPTER):
- 50 Multiple Choice Questions ("mcq")
- 10 True/False Questions ("tf")
- 15 Fill in the Blanks Questions ("fib")
- 25 Match the Following Questions ("match")

OUTPUT FORMAT REQUIREMENTS:
- Pure raw CSV text only. Do not include markdown formatting, code blocks, backticks, or any conversational preamble/closing text.
- Output the CSV header row only once at the very beginning of the response.
- Exactly 13 columns per row, with every field strictly enclosed in double quotes ("...").
- Every single question must be on its own separate line. Do not include literal newlines/line breaks inside any quoted string.
- High factual accuracy derived exclusively from the provided textbook content.
- For chemical formulas, ions, equations, or scientific notation, write them in clean plain text (e.g., "H2SO4", "KMnO4", "Fe3+", "CuSO4.5H2O") to prevent CSV syntax corruption.

COLUMN SPECIFICATIONS (13 COLUMNS):
1. Type: "mcq", "tf", "fib", or "match"
2. Standard: Grade / Class (e.g., "${std}")
3. Subject: "${sub}"
4. Chapter: Exact Chapter Number / Title (e.g., "${chap}")
5. Topic: Specific section or sub-topic from that chapter (e.g., "${topic}")
6. Question: The question prompt.
   * STRICT INSTRUCTION FOR "match": Column 6 MUST NEVER be generic (never write "Match the following" or "Match"). It MUST be an explicit, topic-specific instruction (e.g., "Match each metal ore with its primary chemical formula:", "Match each term with its precise scientific definition:").
7. OptA: Option A for "mcq"; Pair 1 [Item1:Match1] for "match"; empty "" for "tf" and "fib".
8. OptB: Option B for "mcq"; Pair 2 [Item2:Match2] for "match"; empty "" for "tf" and "fib".
9. OptC: Option C for "mcq"; Pair 3 [Item3:Match3] for "match"; empty "" for "tf" and "fib".
10. OptD: Option D for "mcq"; Pair 4 [Item4:Match4] for "match"; empty "" for "tf" and "fib".
11. CorrectOpt:
    * For "mcq": Index digit (1, 2, 3, or 4) corresponding to OptA, OptB, OptC, or OptD.
    * For "tf": "True" or "False".
    * For "fib": The precise target word, term, or chemical formula filling the "_____" blank.
    * For "match": "MATCH".
12. Explanation: Clear, concise explanation citing the textbook rule, reaction, or definition.
13. Stream: "${stream}"

HEADER ROW:
Type,Standard,Subject,Chapter,Topic,Question,OptA,OptB,OptC,OptD,CorrectOpt,Explanation,Stream

DATA ROW TEMPLATES:
"mcq","${std}","${sub}","${chap}","${topic}","[Question statement]","[Opt A]","[Opt B]","[Opt C]","[Opt D]","1","[Explanation]","${stream}"
"tf","${std}","${sub}","${chap}","${topic}","[Factual Statement]","","","","","True","[Explanation]","${stream}"
"fib","${std}","${sub}","${chap}","${topic}","[Statement with _____ blank]","","","","","[Word]","[Explanation]","${stream}"
"match","${std}","${sub}","${chap}","${topic}","Match each [specific topic/attribute] with their corresponding [target]:","[Item1:Match1]","[Item2:Match2]","[Item3:Match3]","[Item4:Match4]","MATCH","[Explanation]","${stream}"

TEXTBOOK CONTENT:
"""
[PASTE TEXTBOOK CONTENT HERE]
"""`;
}

function copyAiStudioPrompt() {
  const promptBox = document.getElementById("aiStudioPromptTextarea");
  if (!promptBox) return;
  navigator.clipboard.writeText(promptBox.value).then(() => {
    const btn = document.getElementById("btnCopyPrompt");
    if (btn) { btn.innerText = "✅ Copied!"; setTimeout(() => { btn.innerText = "📋 Copy Prompt"; }, 2000); }
  });
}

function parseCustomCsv(text) {
  if (!text) return [];
  
  let cleanText = text.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  cleanText = cleanText.replace(/"\s+("mcq"|"tf"|"fib"|"match")/gi, '"\n$1');

  const lines = [];
  let row = [];
  let inQuotes = false;
  let currentField = '';

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentField.trim());
      currentField = '';
    } else if (char === '\n' && !inQuotes) {
      row.push(currentField.trim());
      if (row.some(f => f.length > 0)) lines.push(row);
      row = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || row.length > 0) {
    row.push(currentField.trim());
    if (row.some(f => f.length > 0)) lines.push(row);
  }

  return lines;
}

function processParsedCsvRows(rows) {
  if (!rows || rows.length === 0) return alert("Empty CSV.");
  const fallbackStd = document.getElementById("authorStdSelect") ? document.getElementById("authorStdSelect").value : "5";
  const fallbackSub = document.getElementById("authorSubSelect") ? document.getElementById("authorSubSelect").value : "Science";
  const fallbackStream = normalizeStream(document.getElementById("authorStreamSelect") ? document.getElementById("authorStreamSelect").value : "ncert");
  const fallbackChap = (document.getElementById("authorChapterInput")?.value || "").trim() || "General";
  const fallbackTopic = (document.getElementById("authorTopicInput")?.value || "").trim() || "All";

  const firstRowStr = rows[0].join(" ").toLowerCase();
  const isHeaderPresent = firstRowStr.includes("question") || firstRowStr.includes("type");
  const startIndex = isHeaderPresent ? 1 : 0;

  const existingQuestionsSet = new Set();
  if (Array.isArray(masterQuestions)) {
    masterQuestions.forEach(q => {
      if (q && q.question) {
        const cleanKey = q.question.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanKey) existingQuestionsSet.add(cleanKey);
      }
    });
  }

  const seenInBatchSet = new Set();
  let duplicateCount = 0;
  globalStandaloneCsvList = [];

  for (let i = startIndex; i < rows.length; i++) {
    let r = rows[i];
    if (!r || r.length < 6) continue;

    let type = (r[0] || "mcq").toLowerCase().trim();
    let std = (r[1] || fallbackStd).toString().replace(/class/gi, "").trim();
    let sub = (r[2] || fallbackSub).toString().trim();
    let chap = (r[3] || fallbackChap).toString().trim();
    let topic = (r[4] || fallbackTopic).toString().trim();
    let qText = (r[5] || "").toString().trim();
    let optA = (r[6] || "").toString().trim();
    let optB = (r[7] || "").toString().trim();
    let optC = (r[8] || "").toString().trim();
    let optD = (r[9] || "").toString().trim();
    let correctRaw = (r[10] !== undefined && r[10] !== null) ? r[10].toString().trim() : "";
    let explanation = (r[11] || "").toString().trim();
    let streamVal = normalizeStream(r[12] || fallbackStream);

    if (!qText) continue;

    const matchKey = qText.toLowerCase().replace(/[^a-z0-9]/g, "");
    let isDuplicate = false;
    let dupReason = "";

    if (existingQuestionsSet.has(matchKey)) {
      isDuplicate = true;
      dupReason = "Already in Google Sheet";
      duplicateCount++;
    } else if (seenInBatchSet.has(matchKey)) {
      isDuplicate = true;
      dupReason = "Duplicate in this pasted CSV";
      duplicateCount++;
    } else {
      seenInBatchSet.add(matchKey);
    }

    globalStandaloneCsvList.push({
      type,
      standard: std,
      subject: sub,
      chapter: chap,
      topic: topic,
      question: qText,
      optA,
      optB,
      optC,
      optD,
      correctOpt: correctRaw,
      explanation,
      stream: streamVal,
      isDuplicate,
      dupReason
    });
  }

  const countBadge = document.getElementById("standaloneCsvCount");
  if (countBadge) countBadge.innerText = globalStandaloneCsvList.length;

  const dupBadge = document.getElementById("csvDuplicateCountBadge");
  if (dupBadge) {
    dupBadge.innerText = `${duplicateCount} Potential Duplicates (Will save with warning)`;
    dupBadge.style.background = duplicateCount > 0 ? "#fee2e2" : "#dcfce7";
    dupBadge.style.color = duplicateCount > 0 ? "#991b1b" : "#166534";
  }

  const previewBox = document.getElementById("standaloneCsvList");
  previewBox.innerHTML = globalStandaloneCsvList.map((q, idx) => {
    let optionsContent = "";

    if (q.type === "mcq") {
      optionsContent = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin: 6px 0; font-size: 0.82rem; color: #334155; background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <div><strong>A)</strong> ${q.optA || '-'}</div>
          <div><strong>B)</strong> ${q.optB || '-'}</div>
          <div><strong>C)</strong> ${q.optC || '-'}</div>
          <div><strong>D)</strong> ${q.optD || '-'}</div>
        </div>`;
    } else if (q.type === "match") {
      const pairs = [q.optA, q.optB, q.optC, q.optD].filter(Boolean);
      optionsContent = `
        <div style="display:flex; flex-wrap:wrap; gap: 6px; margin: 6px 0;">
          ${pairs.map(p => `<span style="background:#f1f5f9; border:1px solid #cbd5e1; padding:3px 8px; border-radius:4px; font-size:0.8rem; color:#1e293b;">🔗 ${p}</span>`).join("")}
        </div>`;
    }

    const cardBg = q.isDuplicate ? "#fffbeb" : "#ffffff";
    const borderColor = q.isDuplicate ? "#f59e0b" : "#cbd5e1";

    return `
      <div style="padding: 12px; margin-bottom: 10px; border-radius: 8px; border: 1.5px solid ${borderColor}; background: ${cardBg}; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px;">
          <span style="font-weight: 700; font-size: 0.95rem; color: #0f172a;">
            ${idx + 1}. [${getStreamLabel(q.stream)}] [${q.type.toUpperCase()}] ${q.question}
          </span>
          <div style="text-align: right;">
            ${q.isDuplicate ? `<span class="badge" style="background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; margin-bottom:4px;">⚠️ Warning: ${q.dupReason}</span><br>` : ''}
            <span style="font-size: 0.75rem; font-weight: 600; color: #64748b; white-space: nowrap;">
              Class ${q.standard} • ${q.subject} • ${q.chapter}
            </span>
          </div>
        </div>

        ${optionsContent}

        <div style="margin-top: 6px; font-size: 0.84rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
            ✓ Correct: ${q.correctOpt}
          </span>
          ${q.explanation ? `<span style="color: #475569; font-style: italic;"><strong>Explanation:</strong> ${q.explanation}</span>` : ''}
        </div>
      </div>
    `;
  }).join("");

  const uploadBtn = document.getElementById("btnUploadStandaloneCsv");
  if (uploadBtn) {
    uploadBtn.innerText = `🚀 Upload All (${globalStandaloneCsvList.length} Questions)`;
  }

  document.getElementById("standaloneCsvPreviewArea").classList.remove("hidden");
}

function handleStandaloneCsv(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) { processParsedCsvRows(parseCustomCsv(e.target.result)); };
  reader.readAsText(file);
}

function handleDirectCsvPaste() {
  const text = document.getElementById("rawCsvTextInput").value.trim();
  if (!text) return alert("Please paste CSV text.");
  processParsedCsvRows(parseCustomCsv(text));
}

async function submitStandaloneCsvToSheet() {
  if (!globalStandaloneCsvList || globalStandaloneCsvList.length === 0) return alert("No CSV questions loaded.");

  const dupCount = globalStandaloneCsvList.filter(q => q.isDuplicate).length;
  if (dupCount > 0) {
    const proceed = confirm(`⚠️ Warning: ${dupCount} questions appear to be duplicates. Do you still want to upload all ${globalStandaloneCsvList.length} questions to Google Sheet?`);
    if (!proceed) return;
  }

  const payload = {
    action: "importCsvQuestions", 
    userId: (currentUser && currentUser.id) ? currentUser.id : "PRINCIPAL", 
    role: (currentUser && currentUser.role) ? currentUser.role : "principal", 
    questions: globalStandaloneCsvList 
  };

  const uploadBtn = document.getElementById("btnUploadStandaloneCsv");
  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.innerText = "⏳ Uploading to Google Sheet...";
  }

  try {
    const data = await callAppsScript(payload);
    if (data && data.success) {
      alert(`✅ Uploaded ${data.count} questions successfully to Google Sheet!`);
      document.getElementById("standaloneCsvPreviewArea").classList.add("hidden");
      document.getElementById("rawCsvTextInput").value = "";
      globalStandaloneCsvList = [];
      await loadPortalData();
    } else {
      alert("Error uploading CSV: " + (data ? data.error : "Unknown error"));
    }
  } catch (err) {
    alert("Connection error: " + err.message);
  } finally {
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.innerText = "🚀 Upload All to Google Sheet";
    }
  }
}
