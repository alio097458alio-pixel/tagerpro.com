/* ==========================================================================
   TAGER PRO - تاجر برو • كود الموقع الرسمي والربط المباشر
   متصل مع قاعدة بيانات Firebase Realtime Database
   يعمل بتوافق كامل مع برامج الكمبيوتر وهواتف الأندرويد
   ========================================================================== */

// 1. إعدادات الاتصال بقاعدة البيانات
const firebaseConfig = {
  apiKey: "AIzaSyBB_yZ_q7UAbM1-uaE-XoAy3g-tuyr14wo",
  authDomain: "ali1-2ac52.firebaseapp.com",
  databaseURL: "https://ali1-2ac52-default-rtdb.firebaseio.com",
  projectId: "ali1-2ac52",
  storageBucket: "ali1-2ac52.appspot.com",
  messagingSenderId: "868134603145",
  appId: "1:868134603145:web:1a636838f18cf01feaf958"
};

let db = null;
let auth = null;

try {
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.database();

  // تسجيل دخول فوري كـ Anonymous لضمان صلاحيات القراءة والكتابة في Firebase
  auth.signInAnonymously().then(() => {
    console.log("TAGER PRO: تم الاتصال بالقاعدة وتفعيل الجلسة بنجاح.");
  }).catch((err) => {
    console.warn("تنبيه اتصال الجلسة:", err);
  });
} catch (e) {
  console.error("خطأ تهيئة Firebase:", e);
}

// التاجر المسجل حالياً
let currentMerchant = null;

// باقة الـ VIP المحددة حالياً (مطابقة لأسعار البرنامج تماماً)
let currentVipPlan = { name: "VIP 6 أشهر (الأكثر طلباً)", price: 500, months: 6 };

// ==========================================================================
// تهيئة الصفحة عند التحميل
// ==========================================================================
document.addEventListener("DOMContentLoaded", function () {
  initRealtimeSync();
  checkSavedMerchantSession();
  setupShowcaseTabs();
  setupFormEventListeners();
});

// ==========================================================================
// 2. مزامنة التحديثات والصيانة لحظياً
// ==========================================================================
function initRealtimeSync() {
  if (!db) return;

  // أ. فحص وضع صيانة الموقع
  db.ref("Alio7/system_control/maintenance/website").on("value", (snapshot) => {
    const data = snapshot.val();
    const maintScreen = document.getElementById("website-maintenance-screen");
    if (!maintScreen) return;

    if (data && data.active === true) {
      document.getElementById("maint-message-text").innerText =
        data.message || "الموقع قيد التحديث والصيانة لنقدم لكم أفضل خدمة، سنعود للعمل قريباً...";
      document.getElementById("maint-endtime-text").innerText =
        data.expectedEndTime ? `الموعد المتوقع: ${data.expectedEndTime}` : "قريباً جداً";
      maintScreen.classList.add("active");
      document.body.style.overflow = "hidden";
    } else {
      maintScreen.classList.remove("active");
      document.body.style.overflow = "auto";
    }
  });

  // ب. قراءة تحديثات نسخة الكمبيوتر لحظياً
  db.ref("Alio7/system_control/app_updates/pc").on("value", (snapshot) => {
    const pc = snapshot.val();
    if (pc) {
      const verText = pc.version || "v1.0.0";
      const pcVerElements = document.querySelectorAll(".pc-version-val");
      pcVerElements.forEach((el) => (el.innerText = verText));

      if (pc.updateUrl && pc.updateUrl.trim() !== "" && pc.updateUrl !== "#") {
        const downloadUrl = pc.updateUrl.trim();
        const pcDownloadBtns = document.querySelectorAll(".btn-download-pc");
        pcDownloadBtns.forEach((btn) => {
          btn.setAttribute("href", downloadUrl);
          btn.setAttribute("target", "_blank");
        });
      }

      const pcNotes = document.getElementById("pc-release-notes");
      if (pcNotes && pc.notes) {
        pcNotes.innerText = pc.notes;
      }
    }
  });

  // ج. قراءة تحديثات تطبيق الموبايل لحظياً
  db.ref("Alio7/system_control/app_updates/android").on("value", (snapshot) => {
    const android = snapshot.val();
    if (android) {
      const verText = android.version || "v1.0.0";
      const androidVerElements = document.querySelectorAll(".android-version-val");
      androidVerElements.forEach((el) => (el.innerText = verText));

      if (android.updateUrl && android.updateUrl.trim() !== "" && android.updateUrl !== "#") {
        const downloadUrl = android.updateUrl.trim();
        const androidDownloadBtns = document.querySelectorAll(".btn-download-android");
        androidDownloadBtns.forEach((btn) => {
          btn.setAttribute("href", downloadUrl);
          btn.setAttribute("target", "_blank");
        });
      }

      const androidNotes = document.getElementById("android-release-notes");
      if (androidNotes && android.notes) {
        androidNotes.innerText = android.notes;
      }
    }
  });
}

// ==========================================================================
// 3. دوال تنظيف وتنسيق أرقام الهواتف (مثل كود البرنامج الأصلي تماماً)
// ==========================================================================
function normalizePhone(phone) {
  if (!phone) return "";
  let clean = phone.replace(/\D/g, ""); // أرقام فقط
  if (clean.startsWith("20") && clean.length > 10) {
    clean = clean.substring(2);
  } else if (clean.startsWith("0020") && clean.length > 12) {
    clean = clean.substring(4);
  }
  if (clean.startsWith("1") && clean.length === 10) {
    clean = "0" + clean;
  }
  return clean;
}

// ==========================================================================
// 4. إدارة حسابات التجار (تسجيل الدخول، إنشاء حساب، وفحص الحظر)
// ==========================================================================
function checkSavedMerchantSession() {
  const saved = localStorage.getItem("tager_pro_merchant");
  if (saved) {
    try {
      const user = JSON.parse(saved);
      if (db && user.phone) {
        db.ref(`Alio7/${user.phone}`).once("value", (snap) => {
          const liveUser = snap.val();
          if (liveUser) {
            if (liveUser.accountStatus === "banned") {
              alert(`تم حظر هذا الحساب من قِبل الإدارة:\n${liveUser.banReason || 'مخالفة شروط الاستخدام'}`);
              logoutMerchant();
              return;
            }
            currentMerchant = { ...liveUser, phone: user.phone };
            localStorage.setItem("tager_pro_merchant", JSON.stringify(currentMerchant));
            renderLoggedInUI();
          } else {
            logoutMerchant();
          }
        });
      } else {
        currentMerchant = user;
        renderLoggedInUI();
      }
    } catch (e) {
      localStorage.removeItem("tager_pro_merchant");
    }
  }
}

function renderLoggedInUI() {
  const accountBtn = document.getElementById("nav-account-btn");
  if (!accountBtn || !currentMerchant) return;

  const vipBadge = currentMerchant.isVIP ? " ⭐ VIP" : "";
  const displayName = currentMerchant.shopName || currentMerchant.ownerName || "حسابي";
  accountBtn.innerHTML = `<i class="fa-solid fa-store"></i> <span>${displayName}${vipBadge}</span>`;
  accountBtn.classList.add("logged-in");
}

function showAuthModal(tab = "login") {
  const modal = document.getElementById("auth-modal");
  if (!modal) return;

  if (currentMerchant) {
    renderMerchantProfileView();
  } else {
    switchAuthTab(tab);
  }
  modal.classList.add("active");
}

function closeAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.remove("active");
}

function switchAuthTab(tab) {
  const loginTabBtn = document.getElementById("tab-btn-login");
  const registerTabBtn = document.getElementById("tab-btn-register");
  const loginForm = document.getElementById("form-login");
  const registerForm = document.getElementById("form-register");
  const profileView = document.getElementById("merchant-profile-view");

  if (profileView) profileView.style.display = "none";

  if (tab === "login") {
    loginTabBtn?.classList.add("active");
    registerTabBtn?.classList.remove("active");
    if (loginForm) loginForm.style.display = "block";
    if (registerForm) registerForm.style.display = "none";
  } else {
    registerTabBtn?.classList.add("active");
    loginTabBtn?.classList.remove("active");
    if (loginForm) loginForm.style.display = "none";
    if (registerForm) registerForm.style.display = "block";
  }
  hideAlerts();
}

function hideAlerts() {
  const alerts = document.querySelectorAll(".form-alert");
  alerts.forEach((a) => {
    a.classList.remove("error", "success");
    a.innerText = "";
  });
}

function showAlert(formContainerId, message, type = "error") {
  const container = document.getElementById(formContainerId);
  if (!container) return;
  const alertEl = container.querySelector(".form-alert");
  if (alertEl) {
    alertEl.className = `form-alert ${type}`;
    alertEl.innerText = message;
  }
}

// 4.1 دالة إنشاء حساب تاجر جديد
async function handleRegister(e) {
  if (e && e.preventDefault) e.preventDefault();
  hideAlerts();

  const phoneRaw = document.getElementById("reg-phone")?.value || "";
  const password = document.getElementById("reg-password")?.value || "";
  const shopName = document.getElementById("reg-shopname")?.value || "";
  const ownerName = document.getElementById("reg-ownername")?.value || "";
  const shopAddress = document.getElementById("reg-address")?.value || "غير محدد";
  const shopType = document.getElementById("reg-type")?.value || "تجارة عامة";

  const phone = normalizePhone(phoneRaw.trim());

  if (phone.length !== 11 || !phone.startsWith("01")) {
    showAlert("form-register", "يرجى كتابة رقم هاتف صحيح مكون من 11 رقماً يبدأ بـ 01 (مثل: 01012345678).");
    return;
  }

  if (!password || password.trim().length < 6) {
    showAlert("form-register", "يجب أن تكون كلمة المرور 6 خانات أو أكثر لحماية حسابك.");
    return;
  }

  if (!shopName.trim() || !ownerName.trim()) {
    showAlert("form-register", "يرجى كتابة اسم المحل واسم المسؤول.");
    return;
  }

  const submitBtn = document.getElementById("btn-register-submit");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "جاري إنشاء الحساب...";
  }

  try {
    if (!db) {
      throw new Error("جاري الاتصال بالسيرفر، يرجى المحاولة بعد لحظات.");
    }

    // فحص ما إذا كان الرقم مسجلاً بالفعل
    const snap = await db.ref(`Alio7/${phone}`).once("value");
    if (snap.exists()) {
      showAlert("form-register", "هذا الرقم مسجل لدينا بالفعل! اضغط على تسجيل الدخول واكتب كلمة المرور.");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = "إنشاء الحساب فوراً";
      }
      return;
    }

    // تسجيل الحساب في Firebase Auth لضمان التوافق التام مع البرنامج الأصلي
    if (auth) {
      try {
        await auth.createUserWithEmailAndPassword(`${phone}@smartshop.com`, password.trim());
      } catch (authErr) {
        // إذا كان مسجلاً في Auth أو حدث خطأ، نسجل الدخول كـ Anonymous للمتابعة
        console.warn("Auth Notice:", authErr.message);
        await auth.signInAnonymously().catch(() => {});
      }
    }

    // حفظ سجل التاجر بنفس مواصفات وهيكل قاعدة البيانات في برنامج الكمبيوتر وتطبيق الأندرويد
    const newMerchant = {
      phone: phone,
      password: password.trim(),
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      shopAddress: shopAddress.trim(),
      shopType: shopType.trim(),
      accountStatus: "active",
      banReason: "",
      isVIP: false,
      vipExpiry: 0,
      createdAt: Date.now(),
      loginCount: 1,
      presence: {
        isOnline: true,
        lastSeen: Date.now(),
        platform: "web",
        deviceName: "الموقع الرسمي"
      }
    };

    await db.ref(`Alio7/${phone}`).set(newMerchant);

    currentMerchant = newMerchant;
    localStorage.setItem("tager_pro_merchant", JSON.stringify(currentMerchant));

    showAlert("form-register", "تم إنشاء حسابك بنجاح! يعمل حسابك الآن فوراً على الكمبيوتر والموبايل.", "success");

    setTimeout(() => {
      renderLoggedInUI();
      closeAuthModal();
    }, 1200);

  } catch (err) {
    console.error("Register Error:", err);
    showAlert("form-register", "حدث خطأ أثناء إنشاء الحساب: " + (err.message || err));
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "إنشاء الحساب فوراً";
    }
  }
}

// 4.2 دالة تسجيل الدخول
async function handleLogin(e) {
  if (e && e.preventDefault) e.preventDefault();
  hideAlerts();

  const phoneRaw = document.getElementById("login-phone")?.value || "";
  const password = document.getElementById("login-password")?.value || "";

  const phone = normalizePhone(phoneRaw.trim());

  if (!phone || !password.trim()) {
    showAlert("form-login", "يرجى إدخال رقم الهاتف وكلمة المرور.");
    return;
  }

  const submitBtn = document.getElementById("btn-login-submit");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "جاري التحقق من الحساب...";
  }

  try {
    if (!db) {
      throw new Error("جاري الاتصال بالسيرفر، يرجى المحاولة بعد لحظات.");
    }

    // جلب بيانات الحساب
    let snap = await db.ref(`Alio7/${phone}`).once("value");
    let matchedKey = phone;

    // فحص تنسيقات المفاتيح البديلة إن وجدت
    if (!snap.exists()) {
      const snapPlus = await db.ref(`Alio7/+${phone}`).once("value");
      if (snapPlus.exists()) {
        snap = snapPlus;
        matchedKey = `+${phone}`;
      } else {
        const snap20 = await db.ref(`Alio7/20${phone}`).once("value");
        if (snap20.exists()) {
          snap = snap20;
          matchedKey = `20${phone}`;
        }
      }
    }

    if (!snap.exists()) {
      showAlert("form-login", "رقم الهاتف غير مسجل. اضغط على (حساب جديد) للتسجيل في ثواني.");
      return;
    }

    const userData = snap.val();

    // فحص حالة الحظر من الإدارة
    if (userData.accountStatus === "banned") {
      showAlert("form-login", `تم حظر هذا الحساب من قِبل الإدارة:\n${userData.banReason || 'مخالفة شروط الاستخدام'}`);
      return;
    }

    // فحص صحة كلمة المرور
    const dbPass = (userData.password || "").toString().trim();
    if (dbPass !== password.trim()) {
      showAlert("form-login", "كلمة المرور غير صحيحة! يرجى التأكد وإعادة المحاولة.");
      return;
    }

    // تسجيل الدخول في Auth إن أمكن
    if (auth) {
      try {
        await auth.signInWithEmailAndPassword(`${phone}@smartshop.com`, password.trim());
      } catch (_) {
        await auth.signInAnonymously().catch(() => {});
      }
    }

    // تحديث عدد مرات الدخول
    const newCount = (userData.loginCount || 0) + 1;
    await db.ref(`Alio7/${matchedKey}/loginCount`).set(newCount).catch(() => {});

    currentMerchant = { ...userData, phone: phone, loginCount: newCount };
    localStorage.setItem("tager_pro_merchant", JSON.stringify(currentMerchant));

    showAlert("form-login", "تم تسجيل الدخول بنجاح!", "success");

    setTimeout(() => {
      renderLoggedInUI();
      closeAuthModal();
    }, 800);

  } catch (err) {
    console.error("Login Error:", err);
    showAlert("form-login", "تعذر تسجيل الدخول: " + (err.message || err));
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "دخول إلى الحساب";
    }
  }
}

// 4.3 عرض بيانات التاجر بعد تسجيل الدخول
function renderMerchantProfileView() {
  const modalTabs = document.querySelector(".modal-tabs");
  const loginForm = document.getElementById("form-login");
  const registerForm = document.getElementById("form-register");
  const profileView = document.getElementById("merchant-profile-view");

  if (modalTabs) modalTabs.style.display = "none";
  if (loginForm) loginForm.style.display = "none";
  if (registerForm) registerForm.style.display = "none";

  if (profileView && currentMerchant) {
    profileView.style.display = "block";
    document.getElementById("profile-shop-name").innerText = currentMerchant.shopName || "متجري";
    document.getElementById("profile-owner-name").innerText = currentMerchant.ownerName ? `المسؤول: ${currentMerchant.ownerName}` : "";
    document.getElementById("profile-phone").innerText = currentMerchant.phone || "";
    document.getElementById("profile-vip-status").innerText = currentMerchant.isVIP ? "👑 حساب VIP مفعل" : "حساب عادي مجاني";
    document.getElementById("profile-vip-status").style.color = currentMerchant.isVIP ? "#FFD700" : "#94A3B8";
  }
}

function logoutMerchant() {
  currentMerchant = null;
  localStorage.removeItem("tager_pro_merchant");

  const accountBtn = document.getElementById("nav-account-btn");
  if (accountBtn) {
    accountBtn.innerHTML = `<i class="fa-solid fa-user"></i> <span>دخول / حساب جديد</span>`;
    accountBtn.classList.remove("logged-in");
  }

  const modalTabs = document.querySelector(".modal-tabs");
  if (modalTabs) modalTabs.style.display = "flex";
  switchAuthTab("login");
  closeAuthModal();
}

// ==========================================================================
// 5. إدارة طلبات اشتراك الـ VIP (مطابقة لأسعار البرنامج تماماً)
// ==========================================================================
function openVipModalWithPlan(planName, price) {
  currentVipPlan = { name: planName, price: price };
  
  // تحديث محدد المدة في النافذة
  const select = document.getElementById("vip-duration-select");
  if (select) {
    for (let opt of select.options) {
      if (opt.value.includes(price.toString())) {
        select.value = opt.value;
        break;
      }
    }
  }

  showVipModal();
}

function onVipSelectChange(selectElem) {
  const val = selectElem.value;
  const parts = val.split("|");
  const months = parseInt(parts[0]) || 1;
  const price = parseInt(parts[1]) || 100;

  const names = {
    1: "VIP شهر واحد (عرض البداية)",
    3: "VIP 3 أشهر (وفر 20 ج)",
    6: "VIP 6 أشهر (⭐ الأكثر طلباً)",
    12: "VIP سنة كاملة (وفر 300 ج)"
  };

  currentVipPlan = {
    name: names[months] || `VIP ${months} أشهر`,
    price: price,
    months: months
  };

  const planText = document.getElementById("vip-plan-selected");
  if (planText) {
    planText.innerText = `${currentVipPlan.name} (${currentVipPlan.price} ج.م)`;
  }
}

function showVipModal() {
  const modal = document.getElementById("vip-request-modal");
  if (!modal) return;

  const planText = document.getElementById("vip-plan-selected");
  if (planText) {
    planText.innerText = `${currentVipPlan.name} (${currentVipPlan.price} ج.م)`;
  }

  if (currentMerchant) {
    const phoneInput = document.getElementById("vip-phone");
    const nameInput = document.getElementById("vip-name");
    if (phoneInput) phoneInput.value = currentMerchant.phone || "";
    if (nameInput) nameInput.value = currentMerchant.shopName || currentMerchant.ownerName || "";
  }

  modal.classList.add("active");
}

function closeVipModal() {
  const modal = document.getElementById("vip-request-modal");
  if (modal) modal.classList.remove("active");
}

async function handleVipRequestSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  
  const phoneRaw = document.getElementById("vip-phone")?.value || "";
  const name = document.getElementById("vip-name")?.value || "";
  const transferPhoneRaw = document.getElementById("vip-transfer-phone")?.value || "";
  const transferRef = document.getElementById("vip-transfer-ref")?.value || "";

  const phone = normalizePhone(phoneRaw.trim());
  const transferPhone = normalizePhone(transferPhoneRaw.trim());

  if (!phone || !name.trim() || !transferPhone) {
    alert("يرجى كتابة رقم هاتف حسابك، اسم المحل، ورقم الهاتف الذي قمت بالتحويل منه.");
    return;
  }

  const submitBtn = document.getElementById("btn-vip-submit");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "جاري إرسال إشعار التحويل للإدارة...";
  }

  try {
    const reqId = "req_" + Date.now();
    const reqPayload = {
      id: reqId,
      userPhone: phone,
      userName: name.trim(),
      planName: currentVipPlan.name,
      price: currentVipPlan.price,
      transferPhone: transferPhone,
      transferName: transferRef.trim() || "تحويل فودافون كاش / إنستاباي",
      notes: `طلب اشتراك ${currentVipPlan.name} مرسل عبر الموقع الرسمي`,
      requestTime: Date.now(),
      status: "pending",
      source: "website"
    };

    // إرسال الطلب للوحة الإدارة الرئيسية ليظهر للمشرف فوراً
    await db.ref(`Alio7/admin/vip_requests/${reqId}`).set(reqPayload);

    // تسجيل الطلب أيضاً تحت حساب المستخدم في حال كان الحساب موجوداً
    await db.ref(`Alio7/${phone}/vipRequests/${reqId}`).set(reqPayload).catch(() => {});

    alert(`تم استلام إشعار التحويل بنجاح!\nسيقوم فريق الدعم بمراجعة الحوالة وتفعيل باقة (${currentVipPlan.name}) لحسابك خلال دقائق.`);
    closeVipModal();

  } catch (err) {
    console.error("VIP Request Error:", err);
    alert("حدث خطأ أثناء إرسال الطلب: " + (err.message || err));
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "إرسال إشعار التحويل للإدارة وتفعيل الحساب";
    }
  }
}

// ==========================================================================
// 6. معرض الصور الحقيقية للبرنامج
// ==========================================================================
const realShowcaseData = {
  pc: {
    headerTitle: "شاشة الكاشير ونقطة البيع في نسخة الكمبيوتر",
    title: "نقطة بيع سريعة تدعم قارئ الباركود والطابعات",
    desc: "شاشة كاشير عملية جداً تتيح لك البيع بالباركود أو البحث السريع باسم السلعة، حساب الخصم والإجمالي بضغطة واحدة، وطباعة فواتير حرارية وإرسالها فوراً لواتساب العميل.",
    image: "assets/pc_mockup.jpg",
    caption: "شاشة المبيعات والكاشير وقراءة الباركود المتصلة بطابعة الفواتير",
    features: [
      "تنقل فوري بزر Enter في لوحة المفاتيح لإدخال المنتجات بدون لمس الماوس",
      "تنبيه موحد ذكي يوضح عدد النواقص الإجمالي بدون إزعاج متكرر",
      "قسم مخصص للإيرادات والخدمات المستقلة غير المأخوذة من المخزن"
    ]
  },
  mobile: {
    headerTitle: "تطبيق الموبايل لمتابعة المبيعات من هاتفك",
    title: "شغل محلك من الكمبيوتر وتابع مبيعاتك من موبايلك",
    desc: "تطبيق أندرويد متزامن لحظياً مع جهاز الكمبيوتر في المحل؛ يمكنك معرفة إجمالي مبيعات اليوم، الفواتير الجديدة، وحركة الصندوق في أي وقت ومن أي مكان.",
    image: "assets/mobile_mockup.jpg",
    caption: "واجهة تطبيق الهاتف: لوحة مبيعات، إصدار فواتير، ومشاركة فورية عبر واتساب",
    features: [
      "متابعة حية للمبيعات والأرباح من أي مكان خارج المحل",
      "إمكانية إصدار فواتير سريعة بالهاتف ومشاركتها مع الزبائن",
      "تطبيق خفيف جداً وسلس ويعمل على جميع هواتف الأندرويد"
    ]
  },
  invoice: {
    headerTitle: "نماذج الفواتير الرسمية والطباعة الحرارية",
    title: "فواتير أنيقة وواضحة ترضي زبائنك",
    desc: "يدعم تاجر برو طباعة الفواتير الحرارية بجميع مقاساتها (80mm و 58mm) وفواتير مقاس A4، بالإضافة لإرسال الفاتورة كصورة أو رسالة منسقة عبر واتساب للعميل بضغطة زر.",
    image: "assets/invoice_sample.jpg",
    caption: "نموذج فعلي لفواتير تاجر برو المطبوعة والجاهزة للمشاركة عبر واتساب",
    features: [
      "تنسيق رسمي يحتوي على اسم المحل، التاريخ، رقم الفاتورة، وتفاصيل الأصناف",
      "إمكانية إضافة اسم الزبون وتحديد نوع الدفع (كاش أو آجل)",
      "إرسال مباشر إلى رقم واتساب العميل دون الحاجة لحفظ الرقم في جهات الاتصال"
    ]
  },
  inventory: {
    headerTitle: "إدارة المخزن وجرد الأصناف والنواقص",
    title: "تحكم كامل في بضاعتك وأسعار الجملة والقطاعي",
    desc: "تنظيم محكم لجميع منتجاتك، معرفة تكلفة الشراء وسعر البيع للقطاعي والجملة، مع تنبيه ذكي مجمع يوضح عدد الأصناف التي أوشكت على النفاد لشراء النواقص أولاً بأول.",
    image: "assets/pc_mockup.jpg",
    caption: "شاشة المخزن: أسعار الشراء، البيع قطاعي، الجملة، والكميات المتبقية",
    features: [
      "إدخال منظم للأصناف بضغطة Enter متتالية بدون الحاجة للمس الفأرة نهائياً",
      "معرفة الأرباح المتوقعة من كل صنف بوضوح تام",
      "كشف نواقص مجمع في تنبيه واحد أنيق بدون إغراق الشاشة بإشعارات متكررة"
    ]
  }
};

function setupShowcaseTabs() {
  const tabBtns = document.querySelectorAll(".showcase-tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      tabBtns.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      const tabKey = this.getAttribute("data-tab");
      renderShowcaseContent(tabKey);
    });
  });
}

function renderShowcaseContent(key) {
  const data = realShowcaseData[key];
  if (!data) return;

  const headerTitleEl = document.getElementById("showcase-header-title");
  const titleEl = document.getElementById("mockup-title");
  const descEl = document.getElementById("mockup-desc");
  const featsEl = document.getElementById("mockup-features-list");
  const imgEl = document.getElementById("mockup-main-image");
  const captionEl = document.getElementById("mockup-image-caption");

  if (headerTitleEl) headerTitleEl.innerText = data.headerTitle;
  if (titleEl) titleEl.innerText = data.title;
  if (descEl) descEl.innerText = data.desc;
  if (imgEl) imgEl.src = data.image;
  if (captionEl) captionEl.innerText = data.caption;

  if (featsEl && data.features) {
    featsEl.innerHTML = data.features
      .map((f) => `<div class="mockup-feat-item"><i class="fa-solid fa-circle-check"></i> <span>${f}</span></div>`)
      .join("");
  }
}

// ==========================================================================
// 7. ربط النماذج والأزرار
// ==========================================================================
function setupFormEventListeners() {
  // فتح وإغلاق القائمة في الموبايل
  const navToggle = document.getElementById("nav-toggle-btn");
  const navLinks = document.querySelector(".nav-links");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isVisible = navLinks.style.display === "flex";
      navLinks.style.display = isVisible ? "none" : "flex";
    });
  }

  // نموذج تسجيل الدخول
  const loginForm = document.getElementById("form-login-element");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  // نموذج إنشاء حساب جديد
  const regForm = document.getElementById("form-register-element");
  if (regForm) {
    regForm.addEventListener("submit", handleRegister);
  }

  // نموذج طلب VIP
  const vipForm = document.getElementById("vip-request-form");
  if (vipForm) {
    vipForm.addEventListener("submit", handleVipRequestSubmit);
  }
}
