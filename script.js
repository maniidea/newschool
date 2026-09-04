const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwRKCTYddMALyLdSrik2dQXOg1GVuscLs8-8vnkD2LBJNuxGpqIKls2y8IoPEvfpCnQ/exec" ;

let currentUser = null ;
let masterCurriculum = [] ;
let masterQuestions = [] ;
let masterUserScores = [] ;
let teacherStudentScores = [] ;
let principalDashboardData = { scores: [], teachers: [], students: [] } ;

let activeQuizList = [] ;
let currentQIndex = 0 ;
let userScore = 0 ;
let perQuestionTime = 20 ;
let timeRemaining = 0 ;
let timerInterval = null ;
let autoNextTimeout = null ;
let isAnswered = false ;
let extractedAiBatch = [] ;
let globalStandaloneCsvList = [] ;

let examReviewRecord = [] ;
let wrongQuestionsVault = [] ;
let bonusRetakesRemaining = 0 ;

// Audio Sound FX
const soundCorrect = new Audio("https://actions.google.com/sounds/v1/cartoon/pop.ogg") ;
const soundWrong = new Audio("https://actions.google.com/sounds/v1/cartoon/clank_car_crash.ogg") ;

const GLOBAL_STANDARDS = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
  "UG-1st-Year", "UG-2nd-Year", "UG-Final-Year", "PG", "Diploma"
] ;

const GLOBAL_SUBJECTS = ["Science", "Maths", "Social Science", "English", "Hindi", "Tamil", "Botany", "Zoology", "Physics", "Chemistry"] ;

function initApp() {
  const savedUser = localStorage.getItem("hmsUser") ;
  if (savedUser) {
    try { currentUser = JSON.parse(savedUser); } catch(e) { currentUser = null; } 
  }

  populateAllDropdowns() ;
  updateAuthUI() ;
  loadPortalData() ;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp) ;
} else {
  initApp() ;
}

function populateAllDropdowns() {
  const signupStd = document.getElementById("signupStd") ;
  if (signupStd) {
    signupStd.innerHTML = GLOBAL_STANDARDS.map(s => `<option value="${s}">${s}</option>`).join("") ;
  }

  const playStd = document.getElementById("playStdSelect") ;
  if (playStd) {
    let allowed = GLOBAL_STANDARDS ;
    if (currentUser) {
      if (currentUser.role === "student") {
        allowed = (currentUser.standards && currentUser.standards.length > 0) ? currentUser.standards : ["1"] ;
      } else if (currentUser.role === "aspirant" || currentUser.role === "principal") {
        allowed = GLOBAL_STANDARDS ;
      } else if (currentUser.role === "teacher") {
        allowed = (currentUser.standards && currentUser.standards.length > 0) ? currentUser.standards : GLOBAL_STANDARDS ;
      }
    }
    playStd.innerHTML = allowed.map(s => `<option value="${s}">${s}</option>`).join("") ;
    syncPlaySubjects() ;
  }

  const authStd = document.getElementById("authorStdSelect") ;
  if (authStd) {
    let allowedStds = GLOBAL_STANDARDS ;
    if (currentUser && currentUser.role === "teacher") {
      allowedStds = (currentUser.standards && currentUser.standards.length > 0) ? currentUser.standards : GLOBAL_STANDARDS ;
    }
    authStd.innerHTML = allowedStds.map(s => `<option value="${s}">${s}</option>`).join("") ;
    syncAuthorSubjects() ;
  }

  ["manageStdFilter", "repStdFilter", "tchRepStdFilter", "prFilterStd"].forEach(id => {
    const el = document.getElementById(id) ;
    if (el) el.innerHTML = '<option value="">All Standards</option>' + GLOBAL_STANDARDS.map(s => `<option value="${s}">${s}</option>`).join("") ;
  });

  const lbFilter = document.getElementById("leaderboardStdFilter") ;
  if (lbFilter) {
    lbFilter.innerHTML = '<option value="all">அனைத்து வகுப்புகள் (All Classes)</option>' + GLOBAL_STANDARDS.map(s => `<option value="${s}">வகுப்பு ${s}</option>`).join("") ;
  }

  ["manageSubFilter", "repSubFilter", "tchRepSubFilter", "prFilterSub"].forEach(id => {
    const el = document.getElementById(id) ;
    if (el) el.innerHTML = '<option value="">All Subjects</option>' + GLOBAL_SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join("") ;
  });
}

async function loadPortalData() {
  try {
    const url = `${SCRIPT_URL}?action=getInitialData${currentUser ? '&userId=' + encodeURIComponent(currentUser.id) : ''}` ;
    const res = await fetch(url) ;
    const data = await res.json() ;

    if (data && data.success) {
      if (data.curriculum) masterCurriculum = data.curriculum ;
      if (data.questions) masterQuestions = data.questions ;
      if (data.user) {
        currentUser = data.user ;
        localStorage.setItem("hmsUser", JSON.stringify(currentUser)) ;
      }
      populateAllDropdowns() ;
      if (typeof updateAiPromptPreview === "function") updateAiPromptPreview() ;
    }
  } catch (err) {
    console.warn("Offline/Network Notice:", err) ;
  }
}

function updateAuthUI() {
  const guestBanner = document.getElementById("guestBanner") ;
  const playCountInput = document.getElementById("playCountInput") ;
  const playAllCheckbox = document.getElementById("playAllCheckbox") ;
  const userBadge = document.getElementById("userBadge") ;
  const btnOpenLogin = document.getElementById("btnOpenLogin") ;
  const btnOpenSignup = document.getElementById("btnOpenSignup") ;
  const btnLogout = document.getElementById("btnLogout") ;
  const playScopeNotice = document.getElementById("playScopeNotice") ;
  const tabReplies = document.getElementById("tabMyReplies") ;

  if (currentUser) {
    if (guestBanner) guestBanner.classList.add("hidden") ;
    if (playCountInput) playCountInput.max = 100 ;
    if (playAllCheckbox) playAllCheckbox.disabled = false ;

    if (btnOpenLogin) btnOpenLogin.classList.add("hidden") ;
    if (btnOpenSignup) btnOpenSignup.classList.add("hidden") ;
    if (btnLogout) btnLogout.classList.remove("hidden") ;
    if (userBadge) {
      userBadge.classList.remove("hidden") ;
      let scope = `Class ${currentUser.standards.join(", ")}` ;
      if (currentUser.role === "principal") scope = "Master School Control" ;
      else if (currentUser.role === "aspirant") scope = "Aspirant Mode (Classes 5-12)" ;
      else if (currentUser.role === "teacher") scope = `Classes: [${currentUser.standards.join(",")}], Subs: [${currentUser.subjects.join(",")}]` ;
      userBadge.innerText = `${currentUser.name} (${currentUser.role.toUpperCase()}) | ${scope}` ;
    }

    if (playScopeNotice) {
      if (currentUser.role === "student") {
        playScopeNotice.innerText = `Attending Class ${currentUser.standards.join(", ")} Assessments.` ;
      } else {
        playScopeNotice.innerText = `Select Category, Standard, Subject, and Topic to begin.` ;
      }
    }

    if (currentUser.role === "principal") {
      document.querySelectorAll(".principal-only").forEach(el => el.classList.remove("hidden")) ;
      document.querySelectorAll(".teacher-principal-only").forEach(el => el.classList.remove("hidden")) ;
    } else if (currentUser.role === "teacher") {
      document.querySelectorAll(".teacher-only").forEach(el => el.classList.remove("hidden")) ;
      document.querySelectorAll(".teacher-principal-only").forEach(el => el.classList.remove("hidden")) ;
    }
    
    const tabScores = document.getElementById("tabMyScores") ;
    if (tabScores) tabScores.classList.remove("hidden") ;

    if (tabReplies) {
      tabReplies.classList.toggle("hidden", currentUser.role !== "student") ;
    }
  } else {
    if (guestBanner) guestBanner.classList.remove("hidden") ;
    if (playCountInput) {
      playCountInput.value = Math.min(parseInt(playCountInput.value, 10) || 5, 10) ;
      playCountInput.max = 10 ;
    }
    if (playAllCheckbox) {
      playAllCheckbox.checked = false ;
      playAllCheckbox.disabled = true ;
    }

    if (btnOpenLogin) btnOpenLogin.classList.remove("hidden") ;
    if (btnOpenSignup) btnOpenSignup.classList.remove("hidden") ;
    if (btnLogout) btnLogout.classList.add("hidden") ;
    if (userBadge) userBadge.classList.add("hidden") ;
    if (tabReplies) tabReplies.classList.add("hidden") ;

    if (playScopeNotice) {
      playScopeNotice.innerText = `Select Category, Standard, Subject, and Topic to begin.` ;
    }

    document.querySelectorAll(".teacher-principal-only, .teacher-only, .principal-only").forEach(el => el.classList.add("hidden")) ;
    const tabScores = document.getElementById("tabMyScores") ;
    if (tabScores) tabScores.classList.add("hidden") ;
  }

  populateAllDropdowns() ;
}


function toggleSignupCategory(val) {
  const stdGroup = document.getElementById("signupStdGroup") ;
  if (stdGroup) {
    if (val === "aspirant") {
      stdGroup.classList.add("hidden") ;
    } else {
      stdGroup.classList.remove("hidden") ;
    }
  }
}
function normalizeText(name) {
  if (!name) return "";
  return name.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function syncPlaySubjects() {
  const playStd = document.getElementById("playStdSelect");
  const subSelect = document.getElementById("playSubSelect");
  if (!playStd || !subSelect) return;

  const std = playStd.value || "5";
  const subMap = new Map();

  masterQuestions
    .filter(q => q.standard === std)
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
  if (!playStd || !subSelect || !chapSelect) return;

  const std = playStd.value || "5";
  const sub = normalizeText(subSelect.value || "Science").toLowerCase();
  const chapterMap = new Map();

  masterQuestions
    .filter(q => q.standard === std && normalizeText(q.subject).toLowerCase() === sub)
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
  if (!playStd || !subSelect || !chapSelect || !topicSelect) return;

  const std = playStd.value || "5";
  const sub = normalizeText(subSelect.value || "Science").toLowerCase();
  const chap = chapSelect.value || "All";

  let filtered = masterQuestions.filter(q => q.standard === std && normalizeText(q.subject).toLowerCase() === sub);
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
  const subSelect = document.getElementById("authorSubSelect") ;
  if (!subSelect) return ;
  const allowedSubs = (currentUser && currentUser.subjects && currentUser.subjects.length > 0 && !currentUser.subjects.includes("All")) ? currentUser.subjects : GLOBAL_SUBJECTS ;
  subSelect.innerHTML = allowedSubs.map(s => `<option value="${s}">${s}</option>`).join("") ;
  syncAuthorChapters() ;
  if (typeof updateAiPromptPreview === "function") updateAiPromptPreview() ;
}

function syncAuthorChapters() {
  const authStd = document.getElementById("authorStdSelect") ;
  const subSelect = document.getElementById("authorSubSelect") ;
  const datalist = document.getElementById("chapterSuggestions") ;
  if (!authStd || !subSelect || !datalist) return ;

  const std = authStd.value ;
  const sub = subSelect.value.toLowerCase() ;
  const matched = masterCurriculum.filter(c => c.standard === std && (c.subject || '').toLowerCase() === sub) ;
  datalist.innerHTML = matched.map(c => `<option value="${c.chapter}">`).join("") ;
  if (typeof updateAiPromptPreview === "function") updateAiPromptPreview() ;
}

function openModal(id) {
  const el = document.getElementById(id) ;
  if (el) el.classList.remove("hidden") ;
}

function closeModal(id) {
  const el = document.getElementById(id) ;
  if (el) el.classList.add("hidden") ;
}

async function handleSignIn() {
  const userId = document.getElementById("loginUserId").value.trim() ;
  const pass = document.getElementById("loginPassword").value.trim() ;
  if (!userId || !pass) return alert("Please enter User ID and Password.") ;

  const payload = { action: "loginUser", userId, password: pass } ;
  try {
    const data = await callAppsScript(payload) ;
    if (data && data.success) {
      currentUser = data.user ;
      localStorage.setItem("hmsUser", JSON.stringify(currentUser)) ;
      closeModal("loginModal") ;
      document.getElementById("loginUserId").value = "" ;
      document.getElementById("loginPassword").value = "" ;
      await loadPortalData() ;
      updateAuthUI() ;
      alert(`Welcome to HariMani School, ${currentUser.name}!`) ;
    } else {
      alert("Sign In failed: " + (data ? data.error : "Unknown error")) ;
    }
  } catch (err) {
    alert("Connection error: " + err.message) ;
  }
}

async function handleSignUp() {
  const userType = document.getElementById("signupUserType").value ;
  const userId = document.getElementById("signupUserId").value.trim() ;
  const name = document.getElementById("signupName").value.trim() ;
  const pass = document.getElementById("signupPassword").value.trim() ;
  const std = document.getElementById("signupStd").value ;

  if (!userId || !name || !pass) return alert("Please complete all registration fields.") ;

  const payload = {
    action: "registerUser", 
    userType: userType, 
    userId: userId, 
    name: name, 
    password: pass, 
    standard: (userType === "aspirant") ? "5,6,7,8,9,10,11,12" : std 
  };

  try {
    const data = await callAppsScript(payload) ;
    if (data && data.success) {
      currentUser = data.user ;
      localStorage.setItem("hmsUser", JSON.stringify(currentUser)) ;
      closeModal("signupModal") ;
      document.getElementById("signupUserId").value = "" ;
      document.getElementById("signupName").value = "" ;
      document.getElementById("signupPassword").value = "" ;
      await loadPortalData() ;
      updateAuthUI() ;
      alert(`Registration complete! Welcome, ${currentUser.name}!`) ;
    } else {
      alert("Registration failed: " + (data ? data.error : "Unknown error")) ;
    }
  } catch (err) {
    alert("Connection error: " + err.message) ;
  }
}

function logout() {
  localStorage.removeItem("hmsUser") ;
  currentUser = null ;
  location.reload() ;
}

function load30DaysChallenge() {
  const container = document.getElementById("challengeGridContainer");
  if (!container) return;

  // மாணவர் முடித்த நாட்களின் எண்ணிக்கையைக் கணக்கிடுதல் (அல்லது சேமிக்கப்பட்ட முன்னேற்றம்)
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
    completedDays = 0; // விருந்தினர் மாணவர் முதல் நாளை மட்டும் முயற்சிக்கலாம்
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
  // Attend Test தாவலுக்கு மாற்றுதல்
  const playTabBtn = document.querySelector(".tabs button");
  switchTab('play', playTabBtn);
  
  // குறிப்பிட்ட நாளுக்கான தேர்வைத் தொடங்குதல்
  alert(`நாள் ${dayNumber} சவால் தேர்வு தொடங்குகிறது!`);
  startQuiz();
}

function switchTab(tab, eventTarget) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active")) ;
  ["playTab", "createTab", "manageTab", "reportsTab", "teacherScoresTab", "principalTab", "leaderboardTab", "feedbackTab", "myRepliesTab", "challenge30Tab"].forEach(id => {
    const el = document.getElementById(id) ;
    if (el) el.classList.add("hidden") ;
  });

  if (eventTarget) eventTarget.classList.add("active") ;

  if (tab === "play") {
    document.getElementById("playTab").classList.remove("hidden") ;
    resetQuizView() ;
  }
if (tab === "challenge30") {
    document.getElementById("challenge30Tab").classList.remove("hidden") ;
    load30DaysChallenge(); // 30 நாட்களுக்கான தரவுகளை லோடு செய்ய
  }
  if (tab === "create") {
    document.getElementById("createTab").classList.remove("hidden") ;
    if (typeof updateAiPromptPreview === "function") updateAiPromptPreview() ;
  }
  if (tab === "manage") {
    document.getElementById("manageTab").classList.remove("hidden") ;
    renderManageTable() ;
  }
  if (tab === "reports") {
    document.getElementById("reportsTab").classList.remove("hidden") ;
    loadUserReports() ;
  }
  if (tab === "leaderboard") {
    document.getElementById("leaderboardTab").classList.remove("hidden") ;
    loadLeaderboard() ;
  }
  if (tab === "teacherScores") {
    document.getElementById("teacherScoresTab").classList.remove("hidden") ;
    loadTeacherStudentScores() ;
  }
  if (tab === "principal") {
    document.getElementById("principalTab").classList.remove("hidden") ;
    loadPrincipalDashboard() ;
  }
  if (tab === "feedback") {
    document.getElementById("feedbackTab").classList.remove("hidden") ;
    loadFeedbackTab() ;
  }
  if (tab === "myReplies") {
    document.getElementById("myRepliesTab").classList.remove("hidden") ;
    loadStudentReplies() ;
  }
}

async function loadFeedbackTab() {
  if (!currentUser) return ;
  const tbody = document.getElementById("feedbackTableBody") ;
  if (!tbody) return ;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">பின்னூட்டங்கள் ஏற்றப்படுகின்றன...</td></tr>` ;

  try {
    const res = await fetch(`${SCRIPT_URL}?action=getFeedbackList&userId=${encodeURIComponent(currentUser.id)}`) ;
    const data = await res.json() ;
    if (data && data.success) {
      renderFeedbackList(data.feedback || []) ;
    } else {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">பின்னூட்டம் கிடைக்கவில்லை.</td></tr>` ;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">பிழை: ${err.message}</td></tr>` ;
  }
}

function renderFeedbackList(list) {
  const tbody = document.getElementById("feedbackTableBody") ;
  if (!tbody) return ;
  tbody.innerHTML = "" ;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">மாணவர்கள் இன்னும் எந்தச் சந்தேகமும் அனுப்பவில்லை.</td></tr>` ;
    return;
  }

  list.forEach(item => {
    const hasReply = Boolean(item.reply) ;
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
    ` ;
  });
}

async function submitTeacherReply(feedbackId) {
  const input = document.getElementById(`replyText_${feedbackId}`) ;
  const text = input ? input.value.trim() : "" ;
  if (!text) return alert("தயவுசெய்து பதிலை எழுதவும்.") ;

  const payload = {
    action: "replyTeacherFeedback", 
    feedbackId: feedbackId, 
    replyText: text, 
    replierName: currentUser ? `${currentUser.name} (${currentUser.role.toUpperCase()})` : "Teacher" 
  };

  const res = await callAppsScript(payload) ;
  if (res && res.success) {
    alert("✅ மாணவருக்குப் பதில் அனுப்பப்பட்டது!") ;
    loadFeedbackTab() ;
  } else {
    alert("பதில் அனுப்புவதில் பிழை ஏற்பட்டது.") ;
  }
}

async function loadStudentReplies() {
  if (!currentUser) return;
  const container = document.getElementById("studentRepliesContainer");
  if (!container) return;
  container.innerHTML = "<p style='text-align:center;'>பதில்கள் ஏற்றப்படுகின்றன...</p>";

  try {
    // Send currentUser.id first, or fallback to name if ID was S01
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
  clearInterval(timerInterval) ;
  clearTimeout(autoNextTimeout) ;
  document.getElementById("quizSetupCard").classList.remove("hidden") ;
  document.getElementById("quizActiveCard").classList.add("hidden") ;
  document.getElementById("quizResultCard").classList.add("hidden") ;
  const rev = document.getElementById("quizReviewArea") ;
  if (rev) rev.classList.add("hidden") ;
  const bAlert = document.getElementById("bonusRewardAlert") ;
  if (bAlert) bAlert.classList.add("hidden") ;
}

function toggleSelectAll(isAll) {
  if (!currentUser) return ;
  const countInput = document.getElementById("playCountInput") ;
  countInput.disabled = isAll ;
  countInput.style.background = isAll ? "#e9ecef" : "#fff" ;
}

let currentUtterance = null;

function speakText(text) {
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech and clear references
    window.speechSynthesis.cancel();

    currentUtterance = new SpeechSynthesisUtterance(text);
    
    // Determine language based on Tamil characters presence
    const isTamil = /[\u0B80-\u0BFF]/.test(text);
    currentUtterance.lang = isTamil ? 'ta-IN' : 'en-US';
    currentUtterance.rate = 0.9;

    // Optional: Select an explicit voice if available
    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(v => v.lang.startsWith(isTamil ? 'ta' : 'en'));
    if (targetVoice) {
      currentUtterance.voice = targetVoice;
    }

    // Prevent garbage collection bug in some browsers
    currentUtterance.onend = () => {
      currentUtterance = null;
    };

    window.speechSynthesis.speak(currentUtterance);
  } else {
    alert("Speech Synthesis is not supported in this browser.");
  }
}

// Preload voices to prevent delay on first click
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

async function startQuiz() {
  const chosenType = document.getElementById("playTypeSelect").value ;
  const std = document.getElementById("playStdSelect").value ;
  const sub = document.getElementById("playSubSelect").value.toLowerCase() ;
  const chap = document.getElementById("playChapterSelect").value ;
  const topic = document.getElementById("playTopicSelect").value ;
  const isAll = currentUser && document.getElementById("playAllCheckbox").checked ;
  
  let count = parseInt(document.getElementById("playCountInput").value, 10) || 5 ;
  if (currentUser && bonusRetakesRemaining > 0) {
    count = Math.min(count + bonusRetakesRemaining, 100) ;
  } else if (!currentUser && count > 10) {
    count = 10 ;
  }

  perQuestionTime = Number(document.getElementById("playTimerSelect").value) ;

  let matched = masterQuestions.filter(q => {
    const mType = (chosenType === "all" || (q.type || "mcq").toLowerCase() === chosenType) ;
    const mStd = q.standard === std ;
    const mSub = normalizeText(q.subject).toLowerCase() === sub ;
    const mChap = (chap === "All" || normalizeText(q.chapter).toLowerCase() === chap.toLowerCase()) ;
    const mTopic = (topic === "All" || normalizeText(q.topic).toLowerCase() === topic.toLowerCase()) ;
    return mType && mStd && mSub && mChap && mTopic ;
  });


  if (matched.length === 0) {
    return alert(`No questions found matching your filter in Class ${std} - ${sub.toUpperCase()}.`) ;
  }

  matched.sort(() => Math.random() - 0.5) ;
  if (!isAll) matched = matched.slice(0, Math.min(count, matched.length)) ;

  activeQuizList = matched ;
  examReviewRecord = [] ;
  wrongQuestionsVault = [] ;
  currentQIndex = 0 ;
  userScore = 0 ;

  document.getElementById("quizSetupCard").classList.add("hidden") ;
  document.getElementById("quizResultCard").classList.add("hidden") ;
  document.getElementById("quizActiveCard").classList.remove("hidden") ;

  renderCurrentQuestion() ;
}

function renderCurrentQuestion() {
  clearInterval(timerInterval) ;
  clearTimeout(autoNextTimeout) ;
  isAnswered = false ;

  const total = activeQuizList.length ;
  const q = activeQuizList[currentQIndex] ;
  const qType = (q.type || "mcq").toLowerCase() ;

  const labels = {
    mcq: "Multiple Choice Question",
    tf: "True or False",
    fib: "Fill in the Blanks",
    match: "Match the Following"
  } ;

  document.getElementById("quizProgressBadge").innerText = `Question ${currentQIndex + 1} of ${total} | [${labels[qType] || qType.toUpperCase()}]` ;
  document.getElementById("btnNextQuestion").innerText = (currentQIndex === total - 1) ? "Submit Test 🏁" : "Next Question ⏩" ;

  const area = document.getElementById("singleQuestionArea") ;
  const audioBtnHtml = `<button class="btn btn-outline-dark voice-btn" onclick="speakText('${q.question.replace(/'/g, "\\'")}')" title="கேள்வியை வாசி (Listen Question)">🔊</button>` ;

  if (qType === "mcq") {
    area.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <h3 style="margin-top:0; font-size:1.15rem; flex:1;">${q.question}</h3>
        ${audioBtnHtml}
      </div>
      <div class="options-grid">
        <button class="opt-btn" onclick="checkMcqAnswer('1', this)">A. ${q.optA}</button>
        <button class="opt-btn" onclick="checkMcqAnswer('2', this)">B. ${q.optB}</button>
        <button class="opt-btn" onclick="checkMcqAnswer('3', this)">C. ${q.optC}</button>
        <button class="opt-btn" onclick="checkMcqAnswer('4', this)">D. ${q.optD}</button>
      </div>
      <div id="explanationBoxArea"></div>
    ` ;
  } else if (qType === "tf") {
    area.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <h3 style="margin-top:0; font-size:1.15rem; flex:1;">${q.question}</h3>
        ${audioBtnHtml}
      </div>
      <div class="options-grid" style="grid-template-columns: 1fr 1fr; margin-top:20px;">
        <button class="opt-btn text-center" style="font-size:1.1rem; font-weight:bold;" onclick="checkTfAnswer('True', this)">✅ True</button>
        <button class="opt-btn text-center" style="font-size:1.1rem; font-weight:bold;" onclick="checkTfAnswer('False', this)">❌ False</button>
      </div>
      <div id="explanationBoxArea"></div>
    ` ;
  } else if (qType === "fib") {
    area.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <h3 style="margin-top:0; font-size:1.15rem; flex:1;">${q.question}</h3>
        ${audioBtnHtml}
      </div>
      <div style="margin-top:20px; display:flex; gap:10px;">
        <input type="text" id="fibInput" placeholder="Type your answer here..." style="font-size:1rem; padding:10px; flex:1;">
        <button class="btn btn-primary" id="btnSubmitFib" onclick="checkFibAnswer()">Submit</button>
      </div>
      <div id="fibFeedback" style="margin-top:10px; font-weight:bold;"></div>
      <div id="explanationBoxArea"></div>
    ` ;
  } else if (qType === "match") {
    const rawPairs = [q.optA, q.optB, q.optC, q.optD].filter(Boolean) ;
    const leftItems = [] ;
    const rightItems = [] ;

    rawPairs.forEach(p => {
      const parts = p.split(":") ;
      leftItems.push(parts[0] ? parts[0].trim() : "") ;
      rightItems.push(parts[1] ? parts[1].trim() : "") ;
    });

    const shuffledRights = [...rightItems].sort(() => Math.random() - 0.5) ;

    let rowsHtml = leftItems.map((left, idx) => `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; background:#f8f9fa; padding:10px; border-radius:6px; border:1px solid var(--border);">
        <span style="font-weight:600; width:45%;">${idx + 1}. ${left}</span>
        <span style="width:10%; text-align:center;">➡️</span>
        <select class="match-select" data-left="${left}" style="width:45%; padding:8px;">
          <option value="">-- Select Match --</option>
          ${shuffledRights.map(r => `<option value="${r}">${r}</option>`).join("")}
        </select>
      </div>
    `).join("") ;

    area.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <h3 style="margin-top:0; font-size:1.15rem; flex:1;">${q.question}</h3>
        ${audioBtnHtml}
      </div>
      <div style="margin-top:15px;">${rowsHtml}</div>
      <button class="btn btn-primary margin-top" id="btnSubmitMatch" onclick="checkMatchAnswer()">Check Matches</button>
      <div id="explanationBoxArea"></div>
    ` ;
  }

  setupTimer() ;
}

function setupTimer() {
  const timerBadge = document.getElementById("timerContainer") ;
  const track = document.getElementById("timerBarTrack") ;
  const fill = document.getElementById("timerBarFill") ;

  if (perQuestionTime > 0) {
    timerBadge.classList.remove("hidden") ;
    track.classList.remove("hidden") ;
    timeRemaining = perQuestionTime ;
    document.getElementById("timerText").innerText = `${timeRemaining}s` ;
    fill.style.width = "100%" ;

    timerInterval = setInterval(() => {
      timeRemaining--; 
      document.getElementById("timerText").innerText = `${timeRemaining}s` ;
      fill.style.width = `${(timeRemaining / perQuestionTime) * 100}%` ;

      if (timeRemaining <= 5) timerBadge.classList.add("danger") ;
      else timerBadge.classList.remove("danger") ;

      if (timeRemaining <= 0) {
        clearInterval(timerInterval) ;
        handleTimeUp() ;
      }
    }, 1000) ;
  } else {
    timerBadge.classList.add("hidden") ;
    track.classList.add("hidden") ;
  }
}

function showExplanationBox() {
  const q = activeQuizList[currentQIndex] ;
  const boxArea = document.getElementById("explanationBoxArea") ;
  if (!boxArea || !q.explanation) return;

  boxArea.innerHTML = `
    <div class="explanation-card" style="margin-top:15px;">
      <strong>💡 ஆசிரியரின் நேரடி வழிகாட்டல் & விளக்கம்:</strong> ${q.explanation}
    </div>
  ` ;
}

function checkMcqAnswer(selected, btn) {
  if (isAnswered) return ;
  isAnswered = true ;
  clearInterval(timerInterval) ;

  const q = activeQuizList[currentQIndex] ;
  const correct = q.correctOpt.toString().trim() ;
  const buttons = btn.parentElement.querySelectorAll(".opt-btn") ;
  buttons.forEach(b => b.disabled = true) ;

  const isCorrect = (selected === correct) ;
  if (isCorrect) {
    try { soundCorrect.play(); } catch(e) {} 
    btn.classList.add("correct") ;
    userScore++ ;
  } else {
    try { soundWrong.play(); } catch(e) {} 
    btn.classList.add("wrong") ;
    const idx = parseInt(correct, 10) - 1 ;
    if (buttons[idx]) buttons[idx].classList.add("correct") ;
    wrongQuestionsVault.push(q) ;
  }

  const optMap = { "1": q.optA, "2": q.optB, "3": q.optC, "4": q.optD } ;
  examReviewRecord.push({
    question: q,
    userChoice: `Option ${selected} (${optMap[selected] || ''})`, 
    correctChoice: `Option ${correct} (${optMap[correct] || ''})`, 
    isCorrect: isCorrect 
  }) ;

  showExplanationBox() ;
  if (perQuestionTime > 0) autoNextTimeout = setTimeout(() => nextQuestion(true), 4500) ;
}

function checkTfAnswer(selected, btn) {
  if (isAnswered) return;
  isAnswered = true;
  clearInterval(timerInterval);

  const q = activeQuizList[currentQIndex];
  
  // Normalize correctOpt to standard boolean string ("true" or "false")
  let rawCorrect = (q.correctOpt !== undefined && q.correctOpt !== null) 
    ? q.correctOpt.toString().trim().toLowerCase() 
    : "false";

  // Handle both text ("true"/"false") and numeric index ("1"=True, "2"=False)
  let normalizedCorrect = "false";
  if (rawCorrect === "true" || rawCorrect === "1" || rawCorrect === "t") {
    normalizedCorrect = "true";
  }

  const selectedNorm = selected.toString().trim().toLowerCase();
  const isCorrect = (selectedNorm === normalizedCorrect);

  // Disable all buttons in the question container
  const buttons = btn.parentElement.querySelectorAll(".opt-btn");
  buttons.forEach(b => b.disabled = true);

  // Find the actual True and False buttons cleanly
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
  if (perQuestionTime > 0) {
    autoNextTimeout = setTimeout(() => nextQuestion(true), 4500);
  }
}

function checkFibAnswer() {
  if (isAnswered) return ;
  const input = document.getElementById("fibInput") ;
  const userAns = (input ? input.value : "").trim() ;
  if (!userAns) return alert("Please type your answer.") ;

  isAnswered = true ;
  clearInterval(timerInterval) ;
  input.disabled = true ;
  const btnSubmit = document.getElementById("btnSubmitFib") ;
  if (btnSubmit) btnSubmit.disabled = true ;

  const q = activeQuizList[currentQIndex] ;
  const correct = q.correctOpt.toString().trim().toLowerCase() ;
  const feed = document.getElementById("fibFeedback") ;

  const isCorrect = (userAns.toLowerCase() === correct) ;
  if (isCorrect) {
    try { soundCorrect.play(); } catch(e) {} 
    feed.style.color = "var(--accent)" ;
    feed.innerText = "✅ Correct Answer!" ;
    userScore++ ;
  } else {
    try { soundWrong.play(); } catch(e) {} 
    feed.style.color = "var(--danger)" ;
    feed.innerText = `❌ Incorrect! Correct Answer: "${q.correctOpt}"` ;
    wrongQuestionsVault.push(q) ;
  }

  examReviewRecord.push({
    question: q,
    userChoice: userAns, 
    correctChoice: q.correctOpt, 
    isCorrect: isCorrect 
  }) ;

  showExplanationBox() ;
  if (perQuestionTime > 0) autoNextTimeout = setTimeout(() => nextQuestion(true), 4500) ;
}

function checkMatchAnswer() {
  if (isAnswered) return ;
  const selects = document.querySelectorAll(".match-select") ;
  let allChosen = true ;
  selects.forEach(s => { if (!s.value) allChosen = false; }) ;
  if (!allChosen) return alert("Please pick an option for each row.") ;

  isAnswered = true ;
  clearInterval(timerInterval) ;
  selects.forEach(s => s.disabled = true) ;
  const btnSubmit = document.getElementById("btnSubmitMatch") ;
  if (btnSubmit) btnSubmit.disabled = true ;

  const q = activeQuizList[currentQIndex] ;
  const pairMap = {} ;
  [q.optA, q.optB, q.optC, q.optD].filter(Boolean).forEach(p => { 
    const [l, r] = p.split(":") ;
    if (l && r) pairMap[l.trim().toLowerCase()] = r.trim().toLowerCase() ;
  });

  let correctCount = 0 ;
  const userPairs = [] ;
  selects.forEach(s => {
    const left = (s.getAttribute("data-left") || "").toLowerCase().trim() ;
    userPairs.push(`${left} -> ${s.value.trim()}`) ;
    if (pairMap[left] && pairMap[left] === s.value.trim().toLowerCase()) { 
      s.style.borderColor = "var(--accent)" ;
      s.style.backgroundColor = "var(--success-bg)" ;
      correctCount++ ;
    } else {
      s.style.borderColor = "var(--danger)" ;
      s.style.backgroundColor = "var(--danger-bg)" ;
    }
  });

  const isCorrect = (correctCount === selects.length) ;
  if (isCorrect) {
    try { soundCorrect.play(); } catch(e) {} 
    userScore++ ;
  } else {
    try { soundWrong.play(); } catch(e) {} 
    wrongQuestionsVault.push(q) ;
  }

  examReviewRecord.push({
    question: q,
    userChoice: userPairs.join("; "), 
    correctChoice: [q.optA, q.optB, q.optC, q.optD].filter(Boolean).join("; "), 
    isCorrect: isCorrect 
  }) ;

  showExplanationBox() ;
  if (perQuestionTime > 0) autoNextTimeout = setTimeout(() => nextQuestion(true), 5500) ;
}

function handleTimeUp() {
  if (isAnswered) return ;
  isAnswered = true ;

  const q = activeQuizList[currentQIndex] ;
  const qType = (q.type || "mcq").toLowerCase() ;

  try { soundWrong.play(); } catch(e) {} 

  if (qType === "mcq") {
    const correct = parseInt(q.correctOpt, 10) ;
    const buttons = document.querySelectorAll("#singleQuestionArea .opt-btn") ;
    buttons.forEach(b => b.disabled = true) ;
    if (buttons[correct - 1]) buttons[correct - 1].classList.add("correct") ;
  } else if (qType === "tf") {
    const correct = q.correctOpt.toString().trim().toLowerCase() ;
    const buttons = document.querySelectorAll("#singleQuestionArea .opt-btn") ;
    buttons.forEach(b => {
      b.disabled = true ;
      if (b.innerText.toLowerCase().includes(correct)) b.classList.add("correct") ;
    });
  } else if (qType === "fib") {
    const input = document.getElementById("fibInput") ;
    if (input) input.disabled = true ;
    const btnSubmit = document.getElementById("btnSubmitFib") ;
    if (btnSubmit) btnSubmit.disabled = true ;
    const feed = document.getElementById("fibFeedback") ;
    if (feed) {
      feed.style.color = "var(--danger)" ;
      feed.innerText = `⏰ Time's up! Correct Answer: "${q.correctOpt}"` ;
    }
  } else if (qType === "match") {
    document.querySelectorAll(".match-select").forEach(s => s.disabled = true) ;
    const btnSubmit = document.getElementById("btnSubmitMatch") ;
    if (btnSubmit) btnSubmit.disabled = true ;
  }

  wrongQuestionsVault.push(q) ;
  examReviewRecord.push({
    question: q,
    userChoice: "Time Out", 
    correctChoice: q.correctOpt, 
    isCorrect: false 
  }) ;

  showExplanationBox() ;
  autoNextTimeout = setTimeout(() => nextQuestion(true), 4500) ;
}

function nextQuestion(auto) {
  clearInterval(timerInterval) ;
  clearTimeout(autoNextTimeout) ;

  if (currentQIndex < activeQuizList.length - 1) {
    currentQIndex++ ;
    renderCurrentQuestion() ;
  } else {
    finishQuiz() ;
  }
}

async function finishQuiz() {
  clearInterval(timerInterval) ;
  clearTimeout(autoNextTimeout) ;

  document.getElementById("quizActiveCard").classList.add("hidden") ;
  document.getElementById("quizResultCard").classList.remove("hidden") ;

  const total = activeQuizList.length ;
  const pct = Math.round((userScore / total) * 100) ;
  document.getElementById("resultScoreDisplay").innerText = `${userScore} / ${total} (${pct}%)` ;

  const bonusBox = document.getElementById("bonusRewardAlert") ;
  const btnWrong = document.getElementById("btnRetakeWrong") ;
  const btnCert = document.getElementById("btnDownloadCert") ;

  if (btnWrong) {
    btnWrong.classList.toggle("hidden", wrongQuestionsVault.length === 0) ;
  }
  if (btnCert) {
    btnCert.classList.toggle("hidden", pct < 60) ;
  }

  let msg = "Sign up or sign in to save permanent score history!" ;

  if (currentUser) {
    if (pct === 100) {
      if (typeof confetti === "function") {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } }) ;
      }
      msg = "🌟 PERFECT SCORE (100%)! போனஸ் சலுகை: 4 கூடுதல் தேர்வுகள் மற்றும் ஆசிரியர் பின்னூட்டம் திறக்கப்பட்டது!" ;
      bonusRetakesRemaining += 4 ;
      if (bonusBox) bonusBox.classList.remove("hidden") ;
    } else if (pct >= 80) {
      if (typeof confetti === "function") {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } }) ;
      }
      msg = "🎉 சிறப்பான தேர்ச்சி! தொடர்ந்து பயிற்சி செய்து 100% மதிப்பெண் பெற முயலவும்." ;
      if (bonusBox) bonusBox.classList.add("hidden") ;
    } else {
      msg = "பாடங்களை மீண்டும் படித்து உங்கள் மதிப்பெண்களை உயர்த்தவும்!" ;
      if (bonusBox) bonusBox.classList.add("hidden") ;
    }
  } else {
    if (bonusBox) bonusBox.classList.add("hidden") ;
  }

// 30 நாள் சவால் முன்னேற்றத்தைப் பதிவு செய்தல்
  if (currentUser) {
    const challengeKey = `hms_challenge_${currentUser.id}`;
    let currentDays = parseInt(localStorage.getItem(challengeKey) || "0", 10);
    // தேர்வு முடித்தவுடன் அடுத்த நாளுக்கு முன்னேற்றம் (সর্বোচ্চ 30 நாட்கள் வரை)
    if (currentDays < 30) {
      localStorage.setItem(challengeKey, currentDays + 1);
    }
  }

  document.getElementById("resultFeedback").innerText = msg ;

  const payload = {
    action: "saveScore", 
    userId: currentUser ? currentUser.id : "GUEST", 
    userName: currentUser ? currentUser.name : "Guest Student", 
    standard: document.getElementById("playStdSelect").value, 
    subject: document.getElementById("playSubSelect").value, 
    chapter: document.getElementById("playChapterSelect").value, 
    topic: document.getElementById("playTopicSelect").value, 
    score: userScore, 
    total: total 
  };

  try { await callAppsScript(payload); } catch (e) { console.warn("Score save:", e); } 
}

function retakeWrongOnly() {
  if (!wrongQuestionsVault || wrongQuestionsVault.length === 0) {
    return alert("தவறான வினாக்கள் எதுவும் இல்லை!") ;
  }
  activeQuizList = [...wrongQuestionsVault] ;
  wrongQuestionsVault = [] ;
  examReviewRecord = [] ;
  currentQIndex = 0 ;
  userScore = 0 ;

  document.getElementById("quizResultCard").classList.add("hidden") ;
  document.getElementById("quizActiveCard").classList.remove("hidden") ;
  renderCurrentQuestion() ;
}

function downloadCertificate() {
  const container = document.getElementById("certificatePrintContainer") ;
  if (!container) return;

  const total = activeQuizList.length || 1 ;
  const pct = Math.round((userScore / total) * 100) ;
  const studentName = (currentUser && currentUser.name) ? currentUser.name : "மதிப்புமிகு மாணவர்" ;
  const std = document.getElementById("playStdSelect") ? document.getElementById("playStdSelect").value : "5" ;
  const sub = document.getElementById("playSubSelect") ? document.getElementById("playSubSelect").value : "பொது மதிப்பீடு" ;
  const dateStr = new Date().toLocaleDateString('ta-IN') ;

  container.innerHTML = `
    <div id="certCaptureElement" style="width: 900px; padding: 40px; border: 10px solid #003366; background: #ffffff; text-align: center; font-family: 'Segoe UI', Arial, sans-serif; box-sizing: border-box; color: #000000; margin: 0 auto;">
      <div style="border: 2px solid #e65100; padding: 25px;">
        <h1 style="color: #003366; font-size: 30px; margin: 0 0 8px 0; font-weight: bold;"> HariMani School </h1>
        <h3 style="color: #e65100; font-size: 18px; margin: 0 0 20px 0; text-transform: uppercase; letter-spacing: 1px;">Certificate of Achievement</h3>
        
        <p style="font-size: 16px; color: #475569; margin: 15px 0;">இச்சான்றிதழ் பெருமையுடன் வழங்கப்படுகிறது</p>
        
        <h2 style="font-size: 28px; color: #0f172a; margin: 10px 0 20px 0; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; display: inline-block;">
          ${studentName}
        </h2>
        
        <p style="font-size: 16px; color: #334155; line-height: 1.8; margin: 15px 30px;">
          வகுப்பு <strong>${std}</strong>, பாடம் <strong>${sub}</strong> ஆகியவற்றில் நடைபெற்ற மதிப்பீட்டுத் தேர்வில் பங்குபெற்று 
          <strong>${userScore} / ${total} (${pct}%)</strong> மதிப்பெண்கள் பெற்று மிகச் சிறப்பாகத் தேர்ச்சி அடைந்துள்ளார் எனச் சான்றளிக்கப்படுகிறது.
        </p>
        
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; padding: 0 40px;">
          <div style="text-align: center;">
            <div style="font-size: 15px; color: #334155; font-weight: 500;">நாள்: ${dateStr}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 16px; font-weight: bold; color: #003366; border-top: 2px solid #003366; padding-top: 5px; min-width: 180px;">
              HARIMANI Q&A WEBSITE
            </div>
          </div>
        </div>
      </div>
    </div>
  ` ;

  const captureEl = document.getElementById("certCaptureElement") ;

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `${studentName.replace(/\s+/g, '_')}_HariMani_Certificate.pdf`,
    image: { type: 'jpeg', quality: 1 },
    html2canvas: { 
      scale: 2, 
      useCORS: true,
      logging: false
    },
    jsPDF: { unit: 'pt', format: 'a4', orientation: 'landscape' }
  } ;

  html2pdf().set(opt).from(captureEl).save().then(() => {
    container.innerHTML = "";
  }) ;
}

async function loadLeaderboard() {
  const tbody = document.getElementById("leaderboardTbody") ;
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">தரவரிசைப் பட்டியல் ஏற்றப்படுகிறது...</td></tr>` ;

  const stdFilter = (document.getElementById("leaderboardStdFilter")?.value) || "all" ;
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getLeaderboard&standard=${encodeURIComponent(stdFilter)}`) ;
    const data = await res.json() ;
    if (data && data.success) {
      renderLeaderboardTable(data.leaderboard || []) ;
    } else {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">தரவுகள் கிடைக்கவில்லை.</td></tr>` ;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">பிழை: ${err.message}</td></tr>` ;
  }
}

function renderLeaderboardTable(list) {
  const tbody = document.getElementById("leaderboardTbody") ;
  if (!tbody) return;
  tbody.innerHTML = "" ;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">இவ்வகுப்பில் இன்னும் தேர்வுகள் பதிவாகவில்லை.</td></tr>` ;
    return;
  }

  const medals = ["🥇 1", "🥈 2", "🥉 3"] ;
  list.forEach((item, idx) => {
    const rankDisplay = medals[idx] || (idx + 1) ;
    tbody.innerHTML += `
      <tr>
        <td style="font-weight:bold; text-align:center;">${rankDisplay}</td>
        <td><strong>${item.userName}</strong> <small style="color:#64748b;">(${item.userId})</small></td>
        <td>வகுப்பு ${item.standard}</td>
        <td>${item.testsCount} தேர்வுகள்</td>
        <td><strong>${item.totalScore} / ${item.totalPossible}</strong></td>
        <td><span class="badge badge-success">${item.percentage}%</span></td>
      </tr>
    ` ;
  });
}

function toggleExamReview() {
  const reviewArea = document.getElementById("quizReviewArea") ;
  if (!reviewArea) return;

  if (!reviewArea.classList.contains("hidden")) {
    reviewArea.classList.add("hidden") ;
    return;
  }

  const list = document.getElementById("reviewQuestionsList") ;
  list.innerHTML = "" ;

  examReviewRecord.forEach((rec, idx) => {
    const q = rec.question ;
    const card = document.createElement("div") ;
    card.className = `review-item-card ${rec.isCorrect ? 'correct-border' : 'wrong-border'}` ;
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <div style="font-weight:bold; font-size:1rem; margin-bottom:6px; flex:1;">
          ${idx + 1}. [${(q.type || 'mcq').toUpperCase()}] ${q.question}
        </div>
        <button class="btn btn-outline-dark voice-btn" onclick="speakText('${q.question.replace(/'/g, "\\'")}')" title="கேள்வியை வாசி">🔊</button>
      </div>
      <div style="margin-bottom:8px;">
        <span class="badge ${rec.isCorrect ? 'badge-success' : 'badge-danger'}">
          ${rec.isCorrect ? '✅ சரி' : '❌ தவறு'}
        </span>
      </div>
      <div style="font-size:0.9rem; margin-bottom:4px;">
        <strong>உங்கள் விடை:</strong> <span style="color:${rec.isCorrect ? 'var(--accent)' : 'var(--danger)'};">${rec.userChoice}</span>
      </div>
      <div style="font-size:0.9rem; margin-bottom:6px;">
        <strong>சரியான விடை:</strong> <span style="color:var(--accent); font-weight:600;">${rec.correctChoice}</span>
      </div>
      <div class="explanation-card" style="margin-top:8px;">
        <strong>📖 பாட விளக்கம்:</strong> ${q.explanation || 'பாடப்புத்தகத்தின் அடிப்படையில் சரிபார்க்கப்பட்டது.'}
      </div>
    ` ;
    list.appendChild(card) ;
  });

  reviewArea.classList.remove("hidden") ;
  reviewArea.scrollIntoView({ behavior: 'smooth' }) ;
}

async function submitTeacherFeedback() {
  if (!currentUser) return alert("Please login to send teacher feedback.") ;
  const msgInput = document.getElementById("teacherFeedbackMessage") ;
  const msg = msgInput.value.trim() ;
  if (!msg) return alert("தயவுசெய்து உங்கள் கருத்து அல்லது சந்தேகத்தை எழுதவும்.") ;

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

  const res = await callAppsScript(payload) ;
  if (res && res.success) {
    alert("✅ உங்கள் சந்தேகம்/கருத்து ஆசிரியருக்கு வெற்றிகரமாக அனுப்பப்பட்டது!") ;
    msgInput.value = "" ;
  } else {
    alert("கருத்தை அனுப்புவதில் பிழை ஏற்பட்டது.") ;
  }
}

function toggleManualTypeInputs(type) {
  document.getElementById("wrapperMcqFields").classList.toggle("hidden", type !== "mcq") ;
  document.getElementById("wrapperTfFields").classList.toggle("hidden", type !== "tf") ;
  document.getElementById("wrapperFibFields").classList.toggle("hidden", type !== "fib") ;
  document.getElementById("wrapperMatchFields").classList.toggle("hidden", type !== "match") ;
}

async function publishManualQuestion() {
  if (!currentUser) return alert("Please sign in as Teacher or Principal.") ;

  const type = document.getElementById("manualQType").value ;
  const std = document.getElementById("authorStdSelect").value ;
  const sub = document.getElementById("authorSubSelect").value ;
  const chap = document.getElementById("authorChapterInput").value.trim() || "General" ;
  const topic = document.getElementById("authorTopicInput").value.trim() || "All" ;
  const qText = document.getElementById("manualQuestionText").value.trim() ;
  const explanation = (document.getElementById("manualExplanation")?.value || "").trim() ;

  if (!qText) return alert("Please enter the question statement.") ;

  let optA = "", optB = "", optC = "", optD = "", correctOpt = "" ;

  if (type === "mcq") {
    optA = document.getElementById("manualOptA").value.trim() ;
    optB = document.getElementById("manualOptB").value.trim() ;
    optC = document.getElementById("manualOptC").value.trim() ;
    optD = document.getElementById("manualOptD").value.trim() ;
    correctOpt = document.getElementById("manualCorrectOptMcq").value ;
    if (!optA || !optB || !optC || !optD) return alert("Please fill all 4 options.") ;
  } else if (type === "tf") {
    correctOpt = document.getElementById("manualCorrectOptTf").value ;
  } else if (type === "fib") {
    correctOpt = document.getElementById("manualCorrectOptFib").value.trim() ;
    if (!correctOpt) return alert("Please enter the correct blank answer.") ;
  } else if (type === "match") {
    optA = document.getElementById("matchPair1").value.trim() ;
    optB = document.getElementById("matchPair2").value.trim() ;
    optC = document.getElementById("matchPair3").value.trim() ;
    optD = document.getElementById("matchPair4").value.trim() ;
    correctOpt = "MATCH" ;
    if (!optA || !optB) return alert("Provide at least 2 matching pairs.") ;
  }

  const payload = {
    action: "saveSingleQuestion", 
    userId: currentUser.id, 
    role: currentUser.role, 
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

  const data = await callAppsScript(payload) ;
  if (data && data.success) {
    alert("✅ Question successfully saved!") ;
    document.getElementById("manualQuestionText").value = "" ;
    if (document.getElementById("manualExplanation")) document.getElementById("manualExplanation").value = "" ;
    await loadPortalData() ;
  }
}

async function extractTextFromPDF(file) {
  if (typeof pdfjsLib === "undefined") throw new Error("PDF.js library is not loaded.") ;
  const arrayBuffer = await file.arrayBuffer() ;
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise ;
  let fullText = "" ;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i) ;
    const textContent = await page.getTextContent() ;
    fullText += ` [Page ${i}] ` + textContent.items.map(item => item.str).join(" ") + "\n" ;
  }
  return fullText ;
}

async function callAppsScript(payload) {
  const res = await fetch(SCRIPT_URL, {
    method: "POST", 
    headers: { "Content-Type": "text/plain;charset=utf-8" }, 
    body: JSON.stringify(payload) 
  });
  return await res.json() ;
}

async function generateViaAI() {
  const fileInput = document.getElementById("aiFileInput") ;
  const file = fileInput.files[0] ;
  if (!file) return alert("Please select a PDF or Image file first.") ;

  const countInput = document.getElementById("aiQuestionCount") ;
  let requestedTotal = parseInt(countInput.value, 10) || 10 ;
  if (requestedTotal > 20) requestedTotal = 20 ;

  const btnExtract = document.getElementById("btnExtractAi") ;
  const progressArea = document.getElementById("aiBatchProgressArea") ;
  const statusText = document.getElementById("aiBatchStatusText") ;
  const progressPct = document.getElementById("aiBatchProgressPct") ;
  const progressBar = document.getElementById("aiBatchProgressBar") ;
  const previewArea = document.getElementById("aiPreviewArea") ;

  btnExtract.disabled = true ;
  progressArea.classList.remove("hidden") ;
  previewArea.classList.add("hidden") ;
  extractedAiBatch = [] ;

  const context = {
    standard: document.getElementById("authorStdSelect").value ,
    subject: document.getElementById("authorSubSelect").value ,
    chapter: document.getElementById("authorChapterInput").value.trim() || "Unit 1" ,
    topic: document.getElementById("authorTopicInput").value.trim() || "General" 
  };

  try {
    let payloadData = "" ;
    let isText = false ;

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      statusText.innerText = "Extracting text from PDF..." ;
      payloadData = await extractTextFromPDF(file) ;
      isText = true ;
    } else {
      statusText.innerText = "Reading image data..." ;
      payloadData = await new Promise((resolve, reject) => {
        const reader = new FileReader() ;
        reader.onload = () => resolve(reader.result) ;
        reader.onerror = reject;
        reader.readAsDataURL(file) ;
      });
      isText = false ;
    }

    statusText.innerText = `Generating ${requestedTotal} multi-category questions via AI...` ;
    progressPct.innerText = "50%" ;
    progressBar.style.width = "50%" ;

    const data = await callAppsScript({
      action: "parseDocument", 
      fileData: payloadData, 
      isText: isText, 
      count: requestedTotal, 
      contextInfo: context 
    });

    progressBar.style.width = "100%" ;
    progressPct.innerText = "100%" ;
    btnExtract.disabled = false ;

    if (data && data.success && Array.isArray(data.questions) && data.questions.length > 0) {
      statusText.innerText = `Generated ${data.questions.length} questions successfully!` ;
      extractedAiBatch = data.questions ;
      document.getElementById("aiTotalCountBadge").innerText = extractedAiBatch.length ;
      renderAiPreview(extractedAiBatch) ;
      previewArea.classList.remove("hidden") ;
    } else {
      progressArea.classList.add("hidden") ;
      alert("Error generating questions:\n" + (data ? data.error : "Unknown error")) ;
    }
  } catch (err) {
    btnExtract.disabled = false ;
    progressArea.classList.add("hidden") ;
    alert("Extraction error: " + err.message) ;
  }
}

function renderAiPreview(questions) {
  const container = document.getElementById("aiPreviewList") ;
  container.innerHTML = "" ;
  questions.forEach((q, idx) => {
    const item = document.createElement("div") ;
    item.style.padding = "8px 0" ;
    item.style.borderBottom = "1px solid #e9ecef" ;
    item.innerHTML = `
      <div style="font-weight:600;">${idx + 1}. [${(q.type || 'mcq').toUpperCase()}] ${q.question}</div>
      ${q.optA ? `<div style="font-size:0.85rem; color:#555;">A) ${q.optA} | B) ${q.optB} | C) ${q.optC} | D) ${q.optD}</div>` : ''}
      <div style="font-size:0.85rem; color:var(--accent); font-weight:bold;">Correct: ${q.correctOpt}</div>
      <div style="font-size:0.82rem; color:#084298; margin-top:3px;"><strong>Explanation:</strong> ${q.explanation || 'N/A'}</div>
    ` ;
    container.appendChild(item) ;
  });
}

async function publishAiBatch() {
  const payload = {
    action: "saveBatchQuestions", 
    userId: currentUser.id, 
    role: currentUser.role, 
    standard: document.getElementById("authorStdSelect").value, 
    subject: document.getElementById("authorSubSelect").value, 
    chapter: document.getElementById("authorChapterInput").value.trim() || "Unit 1", 
    topic: document.getElementById("authorTopicInput").value.trim() || "General", 
    questions: extractedAiBatch 
  };

  const data = await callAppsScript(payload) ;
  if (data && data.success) {
    alert(`✅ Published ${data.count} questions to Question Bank!`) ;
    document.getElementById("aiPreviewArea").classList.add("hidden") ;
    document.getElementById("aiBatchProgressArea").classList.add("hidden") ;
    await loadPortalData() ;
  }
}

function renderManageTable() {
  const tbody = document.getElementById("manageTableBody") ;
  tbody.innerHTML = "" ;

  const search = document.getElementById("manageSearchInput").value.toLowerCase() ;
  const std = document.getElementById("manageStdFilter").value ;
  const sub = document.getElementById("manageSubFilter").value.toLowerCase() ;

  const isPrincipal = currentUser && (currentUser.role === "principal") ;
  const myId = currentUser ? currentUser.id.toLowerCase() : "" ;

  const filtered = masterQuestions.filter(q => {
    const isOwner = (q.creatorId && q.creatorId.toLowerCase() === myId) ;
    if (!isPrincipal && !isOwner) return false ;

    const mSearch = !search || q.question.toLowerCase().includes(search) ;
    const mStd = !std || q.standard === std ;
    const mSub = !sub || q.subject.toLowerCase() === sub ;
    return mSearch && mStd && mSub ;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No questions found.</td></tr>` ;
    return;
  }

  filtered.forEach(q => {
    tbody.innerHTML += `
      <tr>
        <td><strong>Class ${q.standard}</strong></td>
        <td><span class="badge" style="background:#003366; color:#fff;">${(q.type || 'mcq').toUpperCase()}</span></td>
        <td>${q.subject}</td>
        <td><small><strong>${q.chapter}</strong><br>${q.topic}</small></td>
        <td>
          <div style="font-weight:600;">${q.question}</div>
          ${q.optA ? `<small>A) ${q.optA} | B) ${q.optB} | C) ${q.optC} | D) ${q.optD}</small><br>` : ''}
          <small style="color:var(--accent); font-weight:bold;">Correct: ${q.correctOpt}</small>
          ${q.explanation ? `<br><small style="color:#084298;"><strong>Explanation:</strong> ${q.explanation}</small>` : ''}
        </td>
        <td><code>${q.creatorId}</code></td>
        <td><button class="btn btn-danger" style="padding:4px 8px; font-size:0.8rem;" onclick="deleteQuestion('${q.id}')">🗑️ Delete</button></td>
      </tr>
    ` ;
  });
}

function generatePrintablePaper(count) {
  const std = document.getElementById("manageStdFilter").value || "All Classes" ;
  const sub = document.getElementById("manageSubFilter").value || "General Assessment" ;

  let pool = [...masterQuestions] ;
  if (std !== "All Classes") pool = pool.filter(q => q.standard === std) ;
  if (sub !== "General Assessment") pool = pool.filter(q => q.subject.toLowerCase() === sub.toLowerCase()) ;

  if (pool.length === 0) {
    return alert("No questions available for this filter to generate a test paper.") ;
  }

  pool.sort(() => Math.random() - 0.5) ;
  const selected = pool.slice(0, Math.min(count, pool.length)) ;

  const printArea = document.getElementById("printContainer") ;
  printArea.innerHTML = `
    <div class="print-header">
      <h2>HARI MANDIR HIGHER SECONDARY SCHOOL</h2>
      <h3>Official Examination Assessment Question Paper</h3>
      <div style="display:flex; justify-content:space-between; margin-top:10px; font-weight:bold; font-size:0.95rem;">
        <span>Class: ${std}</span>
        <span>Subject: ${sub}</span>
        <span>Max Marks: ${selected.length}</span>
        <span>Time: ${Math.round(selected.length * 1.5)} Mins</span>
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
      <h3 style="text-align:center; border-bottom:1px solid #000; padding-bottom:5px;">CONFIDENTIAL TEACHER ANSWER KEY & EXPLANATIONS</h3>
      <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.85rem;" border="1">
        <thead>
          <tr style="background:#eee;">
            <th style="padding:6px; width:8%;">Q. No</th>
            <th style="padding:6px; width:12%;">Type</th>
            <th style="padding:6px; width:25%;">Correct Answer</th>
            <th style="padding:6px;">Reference / Rationale</th>
          </tr>
        </thead>
        <tbody>
          ${selected.map((q, idx) => `
            <tr>
              <td style="padding:5px; text-align:center;">${idx + 1}</td>
              <td style="padding:5px; text-align:center;">${(q.type || 'mcq').toUpperCase()}</td>
              <td style="padding:5px; font-weight:bold;">${q.correctOpt}</td>
              <td style="padding:5px;">${q.explanation || 'Verified from curriculum textbook.'}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` ;

  window.print() ;
}

async function deleteQuestion(id) {
  if (!confirm("Are you sure you want to remove this question?")) return ;
  const data = await callAppsScript({ action: "deleteQuestion", questionId: id, userId: currentUser.id }) ;
  if (data && data.success) {
    alert("Question deleted.") ;
    await loadPortalData() ;
    renderManageTable() ;
  } else {
    alert(data ? data.error : "Failed to delete question") ;
  }
}

async function loadUserReports() {
  if (!currentUser) return ;
  const tbody = document.getElementById("userScoresTbody") ;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Loading scores...</td></tr>` ;

  try {
    const res = await fetch(`${SCRIPT_URL}?action=getUserScores&userId=${encodeURIComponent(currentUser.id)}`) ;
    const data = await res.json() ;
    if (data && data.success) {
      masterUserScores = data.scores || [] ;
      renderUserBadges(masterUserScores) ;
      filterUserReports() ;
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Error: ${e.message}</td></tr>` ;
  }
}

function renderUserBadges(scores) {
  const container = document.getElementById("badgesContainer") ;
  if (!container) return;
  container.innerHTML = "" ;

  if (!scores || scores.length === 0) {
    container.innerHTML = `<span style="font-size:0.85rem; color:#777;">Attend exams daily to earn achievement badges!</span>` ;
    return;
  }

  const uniqueDates = [...new Set(scores.map(s => (s.date || '').split("T")[0]))].sort().reverse() ;
  let currentStreak = 0 ;
  if (uniqueDates.length > 0) {
    let checkDate = new Date() ;
    for (let d of uniqueDates) {
      const dt = new Date(d) ;
      const diffDays = Math.floor((checkDate - dt) / (1000 * 60 * 60 * 24)) ;
      if (diffDays <= 1) {
        currentStreak++ ;
        checkDate = dt ;
      } else {
        break;
      }
    }
  }

  const streakDisplay = document.getElementById("repStatStreak") ;
  if (streakDisplay) streakDisplay.innerText = `${currentStreak} Days` ;

  const badges = [] ;
  if (currentStreak >= 3) badges.push({ icon: "🔥", title: "3-Day Streak", desc: "Practiced 3 days in a row!" }) ;
  if (currentStreak >= 7) badges.push({ icon: "⚡", title: "7-Day Streak", desc: "Super consistent learner!" }) ;

  const scienceCount = scores.filter(s => (s.subject || '').toLowerCase() === "science" && (Number(s.score) / Number(s.total)) >= 0.8).length ;
  if (scienceCount >= 3) badges.push({ icon: "🔬", title: "Science Master", desc: "3+ High scores in Science!" }) ;

  const tamilCount = scores.filter(s => (s.subject || '').toLowerCase() === "tamil" && (Number(s.score) / Number(s.total)) >= 0.8).length ;
  if (tamilCount >= 3) badges.push({ icon: "📚", title: "Tamil Scholar", desc: "Excellence in Tamil language!" }) ;

  const mathCount = scores.filter(s => (s.subject || '').toLowerCase() === "maths" && (Number(s.score) / Number(s.total)) >= 0.8).length ;
  if (mathCount >= 3) badges.push({ icon: "📐", title: "Math Wizard", desc: "High proficiency in Mathematics!" }) ;

  if (badges.length === 0) {
    container.innerHTML = `<span style="font-size:0.85rem; color:#666;">Keep practicing! Badges unlock at 3-Day streak and subject mastery.</span>` ;
  } else {
    badges.forEach(b => {
      const el = document.createElement("div") ;
      el.className = "badge-card" ;
      el.innerHTML = `
        <div style="font-size:1.6rem;">${b.icon}</div>
        <div style="font-weight:bold; font-size:0.85rem; margin-top:4px;">${b.title}</div>
        <div style="font-size:0.75rem; color:#666;">${b.desc}</div>
      ` ;
      container.appendChild(el) ;
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

  // Sort dates in descending order (newest first)
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
        <td>Class ${s.standard}</td>
        <td>${s.subject}</td>
        <td>${s.chapter} - ${s.topic}</td>
        <td>${s.score} / ${s.total}</td>
        <td><strong>${pct}%</strong></td>
      </tr>
    `;
  });

  document.getElementById("repStatTotal").innerText = filtered.length;
  document.getElementById("repStatAvg").innerText = `${Math.round(totalPct / filtered.length)}%`;
}

async function loadTeacherStudentScores() {
  if (!currentUser) return ;
  const tbody = document.getElementById("teacherStudentScoresTbody") ;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Loading assigned class scores...</td></tr>` ;

  try {
    const res = await fetch(`${SCRIPT_URL}?action=getTeacherStudentScores&userId=${encodeURIComponent(currentUser.id)}`) ;
    const data = await res.json() ;
    if (data && data.success) {
      teacherStudentScores = data.scores || [] ;
      filterTeacherStudentScores() ;
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center;">Error: ${e.message}</td></tr>` ;
  }
}

function filterTeacherStudentScores() {
  const search = document.getElementById("tchRepSearchStudent").value.toLowerCase() ;
  const std = document.getElementById("tchRepStdFilter").value ;
  const sub = document.getElementById("tchRepSubFilter").value.toLowerCase() ;

  const tbody = document.getElementById("teacherStudentScoresTbody") ;
  tbody.innerHTML = "" ;

  const filtered = (teacherStudentScores || []).filter(s => {
    const mStudent = !search || s.userId.toLowerCase().includes(search) || s.userName.toLowerCase().includes(search) ;
    const mStd = !std || s.standard === std ;
    const mSub = !sub || s.subject.toLowerCase() === sub ;
    return mStudent && mStd && mSub ;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No student performance records found.</td></tr>` ;
    return;
  }

  filtered.forEach(s => {
    const pct = Math.round((Number(s.score) / Number(s.total)) * 100) ;
    tbody.innerHTML += `
      <tr>
        <td><strong>${s.userId}</strong></td>
        <td>${s.userName}</td>
        <td>Class ${s.standard}</td>
        <td>${s.subject}</td>
        <td>${s.chapter} - ${s.topic}</td>
        <td><strong>${s.score} / ${s.total} (${pct}%)</strong></td>
        <td>${s.date}</td>
      </tr>
    ` ;
  });
}

async function loadPrincipalDashboard() {
  const res = await fetch(`${SCRIPT_URL}?action=getPrincipalDashboard&userId=${encodeURIComponent(currentUser.id)}`) ;
  const data = await res.json() ;
  if (data && data.success) {
    principalDashboardData = data ;
    renderPrincipalTeacherTable() ;
    renderPrincipalStudentTable() ;
    filterPrincipalScores() ;
  }
}

function renderPrincipalTeacherTable() {
  const tbody = document.getElementById("principalTeacherTbody") ;
  tbody.innerHTML = "" ;

  (principalDashboardData.teachers || []).forEach(t => {
    const stdBoxes = GLOBAL_STANDARDS.map(s => `
      <label style="font-size:0.8rem; margin-right:6px; cursor:pointer;">
        <input type="checkbox" value="${s}" ${t.standards.includes(s) ? 'checked' : ''} onchange="toggleTeacherStd('${t.id}', '${s}', this.checked)"> ${s}
      </label>
    `).join("") ;

    const subBoxes = GLOBAL_SUBJECTS.map(s => `
      <label style="font-size:0.8rem; margin-right:6px; cursor:pointer;">
        <input type="checkbox" value="${s}" ${t.subjects.includes(s) ? 'checked' : ''} onchange="toggleTeacherSub('${t.id}', '${s}', this.checked)"> ${s}
      </label>
    `).join("") ;

    tbody.innerHTML += `
      <tr>
        <td><strong>${t.id}</strong></td>
        <td>${t.name}</td>
        <td>${stdBoxes}</td>
        <td>${subBoxes}</td>
        <td><button class="btn btn-outline-dark" style="padding:4px 8px; font-size:0.8rem;" onclick="saveTeacherPermissions('${t.id}')">💾 Save</button></td>
      </tr>
    ` ;
  });
}

function toggleTeacherStd(tId, std, checked) {
  const teacher = principalDashboardData.teachers.find(t => t.id === tId) ;
  if (!teacher) return;
  if (checked) { if (!teacher.standards.includes(std)) teacher.standards.push(std); }
  else { teacher.standards = teacher.standards.filter(s => s !== std); } 
}

function toggleTeacherSub(tId, sub, checked) {
  const teacher = principalDashboardData.teachers.find(t => t.id === tId) ;
  if (!teacher) return;
  if (checked) { if (!teacher.subjects.includes(sub)) teacher.subjects.push(sub); }
  else { teacher.subjects = teacher.subjects.filter(s => s !== sub); } 
}

async function saveTeacherPermissions(teacherId) {
  const teacher = principalDashboardData.teachers.find(t => t.id === teacherId) ;
  const payload = {
    action: "updateTeacherPermissions", 
    principalId: currentUser.id, 
    targetTeacherId: teacherId, 
    standards: teacher.standards, 
    subjects: teacher.subjects 
  };
  const data = await callAppsScript(payload) ;
  if (data && data.success) alert(`✅ Permissions updated for Teacher: ${teacher.name}`) ;
  else alert("Error: " + (data ? data.error : "Could not update permissions")) ;
}

function renderPrincipalStudentTable() {
  const tbody = document.getElementById("principalStudentTbody") ;
  if (!tbody) return;
  tbody.innerHTML = "" ;

  const studentList = principalDashboardData.students || [] ;
  if (studentList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No registered students yet.</td></tr>` ;
    return;
  }

  studentList.forEach(s => {
    const stdBoxes = GLOBAL_STANDARDS.map(std => `
      <label style="font-size:0.8rem; margin-right:6px; cursor:pointer;">
        <input type="checkbox" value="${std}" ${s.standards.includes(std) ? 'checked' : ''} onchange="toggleStudentStd('${s.id}', '${std}', this.checked)"> ${std}
      </label>
    `).join("") ;

    tbody.innerHTML += `
      <tr>
        <td><strong>${s.id}</strong></td>
        <td>${s.name}</td>
        <td><span class="badge" style="background:${s.role === 'aspirant' ? 'var(--secondary)' : 'var(--primary)'}; color:#fff;">${s.role.toUpperCase()}</span></td>
        <td>${stdBoxes}</td>
        <td><button class="btn btn-outline-dark" style="padding:4px 8px; font-size:0.8rem;" onclick="saveStudentPermissions('${s.id}')">💾 Save Classes</button></td>
      </tr>
    ` ;
  });
}

function toggleStudentStd(sId, std, checked) {
  const student = (principalDashboardData.students || []).find(s => s.id === sId) ;
  if (!student) return;
  if (checked) { if (!student.standards.includes(std)) student.standards.push(std); }
  else { student.standards = student.standards.filter(s => s !== std); } 
}

async function saveStudentPermissions(studentId) {
  const student = (principalDashboardData.students || []).find(s => s.id === studentId) ;
  if (!student) return;
  const payload = {
    action: "updateStudentPermissions", 
    principalId: currentUser.id, 
    targetStudentId: studentId, 
    standards: student.standards 
  };
  const data = await callAppsScript(payload) ;
  if (data && data.success) alert(`✅ Classes updated for Student: ${student.name}`) ;
  else alert("Error: " + (data ? data.error : "Could not update permissions")) ;
}

async function principalCreateTeacher() {
  const id = document.getElementById("newTeacherId").value.trim() ;
  const name = document.getElementById("newTeacherName").value.trim() ;
  const pass = document.getElementById("newTeacherPass").value.trim() ;

  if (!id || !name || !pass) return alert("Enter Teacher ID, Name, and Password.") ;

  const payload = {
    action: "createTeacher", 
    principalId: currentUser.id, 
    teacherId: id, 
    teacherName: name, 
    password: pass, 
    standards: ["5"], 
    subjects: ["Science"] 
  };

  const data = await callAppsScript(payload) ;
  if (data && data.success) {
    alert(`Teacher ${name} created successfully!`) ;
    document.getElementById("newTeacherId").value = "" ;
    document.getElementById("newTeacherName").value = "" ;
    document.getElementById("newTeacherPass").value = "" ;
    loadPrincipalDashboard() ;
  } else {
    alert("Error: " + (data ? data.error : "Could not create teacher")) ;
  }
}

function filterPrincipalScores() {
  const search = document.getElementById("prFilterStudent").value.toLowerCase() ;
  const std = document.getElementById("prFilterStd").value ;
  const sub = document.getElementById("prFilterSub").value.toLowerCase() ;

  const tbody = document.getElementById("principalScoresTbody") ;
  tbody.innerHTML = "" ;

  const filtered = (principalDashboardData.scores || []).filter(s => {
    const mStudent = !search || s.userId.toLowerCase().includes(search) || s.userName.toLowerCase().includes(search) ;
    const mStd = !std || s.standard === std ;
    const mSub = !sub || s.subject.toLowerCase() === sub ;
    return mStudent && mStd && mSub ;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No matching student scores found.</td></tr>` ;
    return;
  }

  filtered.forEach(s => {
    const pct = Math.round((Number(s.score) / Number(s.total)) * 100) ;
    tbody.innerHTML += `
      <tr>
        <td><strong>${s.userId}</strong></td>
        <td>${s.userName}</td>
        <td>Class ${s.standard}</td>
        <td>${s.subject}</td>
        <td>${s.chapter} - ${s.topic}</td>
        <td><strong>${s.score} / ${s.total} (${pct}%)</strong></td>
        <td>${s.date}</td>
      </tr>
    ` ;
  });
}

function switchCreateMethod(method) {
  const btnManual = document.getElementById("btnMethodManual") ;
  const btnAi = document.getElementById("btnMethodAi") ;
  const btnCsv = document.getElementById("btnMethodCsv") ;

  if (btnManual) btnManual.className = (method === 'manual') ? 'btn btn-primary flex-1' : 'btn btn-outline-dark flex-1' ;
  if (btnAi) btnAi.className = (method === 'ai') ? 'btn btn-secondary flex-1' : 'btn btn-outline-dark flex-1' ;
  if (btnCsv) btnCsv.className = (method === 'csv') ? 'btn btn-primary flex-1' : 'btn btn-outline-dark flex-1' ;

  const secManual = document.getElementById("sectionManualCreate") ;
  const secAi = document.getElementById("sectionAiCreate") ;
  const secCsv = document.getElementById("sectionCsvCreate") ;

  if (secManual) secManual.classList.toggle("hidden", method !== 'manual') ;
  if (secAi) secAi.classList.toggle("hidden", method !== 'ai') ;
  if (secCsv) secCsv.classList.toggle("hidden", method !== 'csv') ;

  if (method === 'csv' && typeof updateAiPromptPreview === "function") updateAiPromptPreview() ;
}

function parseCustomCsv(text) {
  if (!text) return [] ;

  let cleanText = text.trim() 
    .replace(/\r\n/g, "\n") 
    .replace(/\r/g, "\n") 
    .replace(/("\s*)("?(mcq|tf|fib|match)"?,)/gi, '$1\n$2') 
    .replace(/([0-9])(\s+)("?(mcq|tf|fib|match)"?,)/gi, '$1\n$3') ;

  const lines = [] ;
  let row = [] ;
  let inQuotes = false ;
  let currentField = '' ;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i] ;
    const nextChar = cleanText[i + 1] ;

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"' ;
        i++ ;
      } else {
        inQuotes = !inQuotes ;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentField.trim()) ;
      currentField = '' ;
    } else if (char === '\n' && !inQuotes) {
      row.push(currentField.trim()) ;
      if (row.some(f => f.length > 0)) lines.push(row) ;
      row = [] ;
      currentField = '' ;
    } else {
      currentField += char ;
    }
  }
  if (currentField || row.length > 0) {
    row.push(currentField.trim()) ;
    if (row.some(f => f.length > 0)) lines.push(row) ;
  }
  return lines ;
}

function processParsedCsvRows(rows) {
  if (!rows || rows.length === 0) {
    alert("The uploaded/pasted CSV does not contain valid data rows.") ;
    return;
  }

  const fallbackStd = document.getElementById("authorStdSelect") ? document.getElementById("authorStdSelect").value : "5" ;
  const fallbackSub = document.getElementById("authorSubSelect") ? document.getElementById("authorSubSelect").value : "Science" ;

  const firstRowStr = rows[0].join(" ").toLowerCase() ;
  const isHeaderPresent = firstRowStr.includes("question") || firstRowStr.includes("type") ;
  const startIndex = isHeaderPresent ? 1 : 0 ;

  globalStandaloneCsvList = [] ;
  let duplicateCount = 0 ;

  const normalizeKey = (str) => {
    if (!str) return "" ;
    return str.toString() 
      .toLowerCase() 
      .replace(/[^\p{L}\p{N}]/gu, '') 
      .trim() ;
  };

  const existingSet = new Set(
    masterQuestions
      .map(q => normalizeKey(q.question))
      .filter(k => k.length > 2)
  ) ;

  for (let i = startIndex; i < rows.length; i++) {
    let r = rows[i] ;
    if (!r || r.length < 5) continue; 

    let type = "mcq" ;
    let std = fallbackStd ;
    let sub = fallbackSub ;
    let chap = "General" ;
    let topic = "All" ;
    let qText = "" ;
    let optA = "", optB = "", optC = "", optD = "" ;
    let correctRaw = "" ;
    let explanation = "" ;

    if (r.length >= 12) {
      type = (r[0] || "mcq").toLowerCase().trim() ;
      std = r[1] || fallbackStd ;
      sub = r[2] || fallbackSub ;
      chap = r[3] || "General" ;
      topic = r[4] || "All" ;
      qText = r[5] ;
      optA = r[6] || "" ;
      optB = r[7] || "" ;
      optC = r[8] || "" ;
      optD = r[9] || "" ;
      correctRaw = r[10] || "" ;
      explanation = r[11] || "" ;
    } else if (r.length >= 7) {
      type = (r[0] || "mcq").toLowerCase().trim() ;
      qText = r[1] ;
      optA = r[2] || "" ;
      optB = r[3] || "" ;
      optC = r[4] || "" ;
      optD = r[5] || "" ;
      correctRaw = r[6] || "" ;
    }

    if (!qText || qText.trim().length < 2) continue; 

    const normalizedKey = normalizeKey(qText) ;
    const isDuplicate = normalizedKey.length > 2 && existingSet.has(normalizedKey) ;
    if (isDuplicate) duplicateCount++ ;

    globalStandaloneCsvList.push({
      type: type, 
      standard: std.toString().replace(/class/gi, "").trim(), 
      subject: sub, 
      chapter: chap, 
      topic: topic, 
      question: qText.trim(), 
      optA: optA.trim(), 
      optB: optB.trim(), 
      optC: optC.trim(), 
      optD: optD.trim(), 
      correctOpt: correctRaw.toString().trim(), 
      explanation: explanation.trim(), 
      isDuplicate: isDuplicate 
    });
  }

  if (globalStandaloneCsvList.length === 0) {
    alert("Could not extract questions. Verify CSV columns.") ;
    return;
  }

  document.getElementById("standaloneCsvCount").innerText = globalStandaloneCsvList.length ;
  const dupBadge = document.getElementById("csvDuplicateCountBadge") ;
  if (dupBadge) {
    dupBadge.innerText = `${duplicateCount} Existing Duplicates Detected` ;
    dupBadge.style.display = duplicateCount > 0 ? "inline-block" : "none" ;
  }

  const previewBox = document.getElementById("standaloneCsvList") ;
  previewBox.innerHTML = globalStandaloneCsvList.map((q, idx) => `
    <div style="padding: 8px; margin-bottom:6px; border-radius:4px; border: 1px solid ${q.isDuplicate ? '#fca5a5' : '#e2e8f0'}; background:${q.isDuplicate ? '#fff1f2' : '#fff'}; font-size: 0.85rem;">
      <div style="display:flex; justify-content:space-between;">
        <strong style="color:#0f172a;">${idx + 1}. [${q.type.toUpperCase()}] ${q.question}</strong>
        ${q.isDuplicate ? '<span class="badge" style="background:#ef4444; color:#fff;">⚠️ Already in Database</span>' : ''}
      </div>
      ${q.optA ? `<span style="color:#64748b;">A) ${q.optA} | B) ${q.optB} | C) ${q.optC} | D) ${q.optD}</span><br>` : ''}
      <span style="color:#059669; font-weight:600;">Correct: ${q.correctOpt} [Class ${q.standard} • ${q.subject}]</span>
      ${q.explanation ? `<br><small style="color:#084298;"><strong>💡 Explanation:</strong> ${q.explanation}</small>` : ''}
    </div>
  `).join("") ;

  document.getElementById("standaloneCsvPreviewArea").classList.remove("hidden") ;
}

function handleStandaloneCsv(event) {
  const file = event.target.files[0] ;
  if (!file) return;

  const reader = new FileReader() ;
  reader.onload = function(e) {
    const rows = parseCustomCsv(e.target.result) ;
    processParsedCsvRows(rows) ;
  };
  reader.readAsText(file) ;
}

function handleDirectCsvPaste() {
  const text = document.getElementById("rawCsvTextInput").value.trim() ;
  if (!text) return alert("Please paste the CSV text first.") ;
  const rows = parseCustomCsv(text) ;
  processParsedCsvRows(rows) ;
}

async function submitStandaloneCsvToSheet() {
  if (!globalStandaloneCsvList || globalStandaloneCsvList.length === 0) {
    return alert("No CSV questions loaded to upload.") ;
  }

  const hasDuplicates = globalStandaloneCsvList.some(q => q.isDuplicate) ;
  if (hasDuplicates) {
    const proceed = confirm("Warning: Some questions in your CSV appear to be duplicates of questions already in the database. Do you wish to continue and upload all of them anyway?") ;
    if (!proceed) return;
  }

  const btn = document.getElementById("btnUploadStandaloneCsv") ;
  btn.disabled = true ;
  btn.innerText = `Uploading ${globalStandaloneCsvList.length} questions to Google Sheet...` ;

  const payload = {
    action: "importCsvQuestions", 
    userId: (currentUser && currentUser.id) ? currentUser.id : "PRINCIPAL", 
    role: (currentUser && currentUser.role) ? currentUser.role : "principal", 
    questions: globalStandaloneCsvList 
  };

  try {
    const data = await callAppsScript(payload) ;
    btn.disabled = false ;
    btn.innerText = "🚀 Upload All to Google Sheet (Auto Serial IDs)" ;

    if (data && data.success) {
      const uploadedCount = data.count || globalStandaloneCsvList.length ;
      const sId = data.startId || "HMS_Q_Start" ;
      const eId = data.endId || "HMS_Q_End" ;
      alert(`✅ Uploaded ${uploadedCount} questions successfully!\nAssigned Serial IDs: ${sId} to ${eId}`) ;
      document.getElementById("standaloneCsvInput").value = "" ;
      document.getElementById("rawCsvTextInput").value = "" ;
      document.getElementById("standaloneCsvPreviewArea").classList.add("hidden") ;
      globalStandaloneCsvList = [] ;
      if (typeof loadPortalData === "function") await loadPortalData() ;
    } else {
      alert("Error: " + (data ? data.error : "Failed to upload questions")) ;
    }
  } catch (err) {
    btn.disabled = false ;
    btn.innerText = "🚀 Upload All to Google Sheet (Auto Serial IDs)" ;
    alert("Connection error: " + err.message) ;
  }
}
