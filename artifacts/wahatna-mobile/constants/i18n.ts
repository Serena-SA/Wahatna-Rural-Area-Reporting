/**
 * Wahatna — multilingual string dictionary
 * Languages: en (English), ar (Arabic RTL), ur (Urdu RTL), hi (Hindi LTR)
 */

export type Language = "en" | "ar" | "ur" | "hi";

export interface Translations {
  // ── Language meta ──────────────────────────────────────────────
  lang_name: string;
  isRTL: boolean;

  // ── Navigation ─────────────────────────────────────────────────
  nav_home: string;
  nav_report: string;
  nav_my_reports: string;
  nav_fleet: string;
  nav_supervisor: string;
  nav_reports: string; // supervisor's "Reports" tab

  // ── Auth ───────────────────────────────────────────────────────
  auth_sign_in: string;
  auth_sign_in_title: string;
  auth_sign_in_subtitle: string;
  auth_username: string;
  auth_password: string;
  auth_email: string;
  auth_no_account: string;
  auth_register: string;
  auth_create_account: string;
  auth_join_subtitle: string;
  auth_all_fields_required: string;
  auth_enter_credentials: string;
  auth_invalid_credentials: string;
  auth_registration_failed: string;
  auth_logout: string;
  auth_demo_hint: string;
  auth_full_name: string;
  auth_full_name_optional: string;

  // ── Home ───────────────────────────────────────────────────────
  home_greeting: string;           // "Welcome, {name}"
  home_report_cta: string;
  home_my_reports: string;
  home_view_all: string;
  home_no_reports_yet: string;
  home_queued_offline: string;     // "{n} reports queued offline"
  home_heat_ban_title: string;
  home_heat_ban_body: string;
  home_safety: string;
  home_language: string;

  // ── Report flow ────────────────────────────────────────────────
  report_title: string;
  report_step_category: string;
  report_step_location: string;
  report_step_photos: string;
  report_step_review: string;
  report_category_label: string;
  report_description_label: string;
  report_description_placeholder: string;
  report_description_min: string;
  report_phone_primary: string;
  report_phone_secondary: string;
  report_phone_placeholder: string;
  report_next: string;
  report_back: string;
  report_skip: string;
  report_submit: string;
  report_submitting: string;
  report_take_photo: string;
  report_choose_library: string;
  report_photos_optional: string;

  // ── Categories ─────────────────────────────────────────────────
  cat_fire: string;
  cat_flood: string;
  cat_road_damage: string;
  cat_electrical: string;
  cat_heat_stress: string;
  cat_waste: string;
  cat_structural: string;
  cat_other: string;

  // ── Location ───────────────────────────────────────────────────
  loc_using_gps: string;
  loc_override_pin: string;
  loc_manual_address: string;
  loc_address_placeholder: string;
  loc_gps_denied_ios: string;
  loc_gps_denied_android: string;
  loc_gps_denied_web: string;
  loc_source_gps: string;
  loc_source_pin: string;
  loc_source_address: string;

  // ── Confirmation ───────────────────────────────────────────────
  confirm_title: string;
  confirm_body: string;
  confirm_reference: string;
  confirm_status: string;
  confirm_expected: string;
  confirm_track: string;
  confirm_another: string;

  // ── My Reports ─────────────────────────────────────────────────
  my_reports_title: string;
  my_reports_empty: string;
  my_reports_loading: string;
  my_reports_updated: string;
  my_reports_status_changed: string; // "Status updated to {status}"
  my_reports_supervisor_notes: string;
  my_reports_timeline: string;
  my_reports_photos_attached: string;

  // ── Status labels ──────────────────────────────────────────────
  status_pending_review: string;
  status_under_review: string;
  status_assigned: string;
  status_completed: string;
  status_rejected: string;
  status_late: string;
  status_active: string;

  // ── Supervisor ─────────────────────────────────────────────────
  sup_title: string;
  sup_access_restricted: string;
  sup_go_home: string;
  sup_total: string;
  sup_pending: string;
  sup_under_review: string;
  sup_assigned: string;
  sup_completed: string;
  sup_late: string;
  sup_critical: string;
  sup_update_status: string;
  sup_add_note: string;
  sup_save_note: string;
  sup_rejection_reason: string;
  sup_rejection_required: string;
  sup_escalated: string;
  sup_due_in: string;        // "Due in {time}"
  sup_overdue: string;       // "LATE — {time} overdue"
  sup_filter_status: string;
  sup_filter_severity: string;
  sup_late_only: string;
  sup_filter_date: string;
  sup_today: string;
  sup_this_week: string;
  sup_all: string;

  // ── Fleet ──────────────────────────────────────────────────────
  fleet_title: string;
  fleet_start_location: string;
  fleet_using_gps: string;
  fleet_transport_mode: string;
  fleet_walking: string;
  fleet_car: string;
  fleet_service_vehicle: string;
  fleet_walking_disclaimer: string;
  fleet_add_waypoint: string;
  fleet_optimize: string;
  fleet_optimizing: string;
  fleet_original_order: string;
  fleet_optimized_route: string;
  fleet_distance_saved: string;
  fleet_time_saved: string;
  fleet_priority_low: string;
  fleet_priority_medium: string;
  fleet_priority_high: string;
  fleet_priority_critical: string;
  fleet_priority_note: string;

  // ── Heat ban ───────────────────────────────────────────────────
  heat_ban_title: string;
  heat_ban_body: string;
  heat_ban_active: string;
  heat_ban_inactive: string;

  // ── Offline ────────────────────────────────────────────────────
  offline_banner: string;
  offline_queued: string;   // "{n} report(s) queued"
  offline_sync_pending: string;
  offline_emergency_warning: string;
  offline_will_submit: string;

  // ── Errors / success ───────────────────────────────────────────
  err_generic: string;
  err_field_required: string;
  err_duplicate_report: string;
  err_network: string;
  err_location: string;
  success_submitted: string;
  success_saved: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// English
// ─────────────────────────────────────────────────────────────────────────────
const en: Translations = {
  lang_name: "English",
  isRTL: false,

  nav_home: "Home",
  nav_report: "Report",
  nav_my_reports: "My Reports",
  nav_fleet: "Fleet",
  nav_supervisor: "Supervisor",
  nav_reports: "Reports",

  auth_sign_in: "Sign In",
  auth_sign_in_title: "WAHATNA",
  auth_sign_in_subtitle: "Al Qua'a Community Safety",
  auth_username: "Username",
  auth_password: "Password",
  auth_email: "Email",
  auth_no_account: "No account?",
  auth_register: "Register",
  auth_create_account: "Create Account",
  auth_join_subtitle: "Join the community reporter network",
  auth_all_fields_required: "All fields are required",
  auth_enter_credentials: "Enter username and password",
  auth_invalid_credentials: "Invalid credentials",
  auth_registration_failed: "Registration failed",
  auth_logout: "Logout",
  auth_demo_hint: "Demo: demo / wahatna2024",
  auth_full_name: "Full Name",
  auth_full_name_optional: "Full Name (optional)",

  home_greeting: "Welcome",
  home_report_cta: "Report a Hazard",
  home_my_reports: "My Reports",
  home_view_all: "View All",
  home_no_reports_yet: "No reports yet",
  home_queued_offline: "report(s) queued offline",
  home_heat_ban_title: "Heat Work Ban Active",
  home_heat_ban_body: "Outdoor work prohibited 12:30–15:00 under MOHRE regulations.",
  home_safety: "Safety Alert",
  home_language: "Language",

  report_title: "Report Hazard",
  report_step_category: "Category & Details",
  report_step_location: "Location",
  report_step_photos: "Photos",
  report_step_review: "Review & Submit",
  report_category_label: "Hazard Category",
  report_description_label: "Description",
  report_description_placeholder: "Describe the hazard in detail (min 20 characters)…",
  report_description_min: "Description must be at least 20 characters",
  report_phone_primary: "Contact Phone",
  report_phone_secondary: "Secondary Phone (optional)",
  report_phone_placeholder: "e.g. 0501234567",
  report_next: "Next",
  report_back: "Back",
  report_skip: "Skip",
  report_submit: "Submit Report",
  report_submitting: "Submitting…",
  report_take_photo: "Take Photo",
  report_choose_library: "Choose from Library",
  report_photos_optional: "Photos are optional but help with assessment",

  cat_fire: "Fire",
  cat_flood: "Flood",
  cat_road_damage: "Road Damage",
  cat_electrical: "Electrical",
  cat_heat_stress: "Heat Stress",
  cat_waste: "Waste",
  cat_structural: "Structural",
  cat_other: "Other",

  loc_using_gps: "Using GPS location",
  loc_override_pin: "Drop a pin on map",
  loc_manual_address: "Enter address",
  loc_address_placeholder: "Address or landmark…",
  loc_gps_denied_ios: "Go to Settings → Privacy → Location Services and enable for Wahatna.",
  loc_gps_denied_android: "Go to Settings → Apps → Wahatna → Permissions → Location and allow.",
  loc_gps_denied_web: "Click the location icon in your browser's address bar and allow access.",
  loc_source_gps: "GPS",
  loc_source_pin: "Map Pin",
  loc_source_address: "Address",

  confirm_title: "Report Received",
  confirm_body: "Your report has been submitted and will be reviewed by the municipality.",
  confirm_reference: "Reference",
  confirm_status: "Status",
  confirm_expected: "Expected response",
  confirm_track: "Track This Report",
  confirm_another: "Report Another Hazard",

  my_reports_title: "My Reports",
  my_reports_empty: "No reports yet. Tap Report Hazard to get started.",
  my_reports_loading: "Loading reports…",
  my_reports_updated: "Reports updated",
  my_reports_status_changed: "Status updated",
  my_reports_supervisor_notes: "Supervisor Notes",
  my_reports_timeline: "Timeline",
  my_reports_photos_attached: "Photo attached",

  status_pending_review: "Pending Review",
  status_under_review: "Under Review",
  status_assigned: "Assigned",
  status_completed: "Completed",
  status_rejected: "Rejected",
  status_late: "Late",
  status_active: "Active",

  sup_title: "Supervisor Dashboard",
  sup_access_restricted: "Access Restricted",
  sup_go_home: "Go to Home",
  sup_total: "Total",
  sup_pending: "Pending",
  sup_under_review: "Under Review",
  sup_assigned: "Assigned",
  sup_completed: "Completed",
  sup_late: "Late",
  sup_critical: "Critical",
  sup_update_status: "Update Status",
  sup_add_note: "Add Note",
  sup_save_note: "Save Note",
  sup_rejection_reason: "Rejection Reason",
  sup_rejection_required: "Rejection reason is required",
  sup_escalated: "Escalated",
  sup_due_in: "Due in",
  sup_overdue: "LATE",
  sup_filter_status: "Status",
  sup_filter_severity: "Severity",
  sup_late_only: "Late Only",
  sup_filter_date: "Date Range",
  sup_today: "Today",
  sup_this_week: "This Week",
  sup_all: "All",

  fleet_title: "Fleet & Routes",
  fleet_start_location: "Start Location",
  fleet_using_gps: "Using current location",
  fleet_transport_mode: "Transport Mode",
  fleet_walking: "Walking",
  fleet_car: "Car",
  fleet_service_vehicle: "Service Vehicle",
  fleet_walking_disclaimer: "Estimated pedestrian path. Actual walkable routes may differ due to terrain or access restrictions.",
  fleet_add_waypoint: "Add Waypoint",
  fleet_optimize: "Optimize Route",
  fleet_optimizing: "Optimizing…",
  fleet_original_order: "Original Order",
  fleet_optimized_route: "Optimized Route",
  fleet_distance_saved: "Distance Saved",
  fleet_time_saved: "Time Saved",
  fleet_priority_low: "Low",
  fleet_priority_medium: "Medium",
  fleet_priority_high: "High",
  fleet_priority_critical: "Critical",
  fleet_priority_note: "Critical stop was moved to front due to high priority",

  heat_ban_title: "Heat Work Ban",
  heat_ban_body: "MOHRE ban: outdoor work prohibited 12:30–15:00 (15 Jun – 15 Sep).",
  heat_ban_active: "Ban Active",
  heat_ban_inactive: "No Active Ban",

  offline_banner: "Offline",
  offline_queued: "queued",
  offline_sync_pending: "Syncing pending reports…",
  offline_emergency_warning: "For life-threatening emergencies call 999 immediately.",
  offline_will_submit: "You are offline. Report will be submitted when connection returns.",

  err_generic: "Something went wrong. Please try again.",
  err_field_required: "Required",
  err_duplicate_report: "A similar report was already submitted within the last 5 minutes for this location.",
  err_network: "Network error. Check your connection.",
  err_location: "Could not get your location.",
  success_submitted: "Report submitted successfully.",
  success_saved: "Saved.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Arabic (RTL)
// ─────────────────────────────────────────────────────────────────────────────
const ar: Translations = {
  lang_name: "العربية",
  isRTL: true,

  nav_home: "الرئيسية",
  nav_report: "بلاغ",
  nav_my_reports: "بلاغاتي",
  nav_fleet: "الأسطول",
  nav_supervisor: "المشرف",
  nav_reports: "البلاغات",

  auth_sign_in: "تسجيل الدخول",
  auth_sign_in_title: "واحتنا",
  auth_sign_in_subtitle: "سلامة مجتمع القاع",
  auth_username: "اسم المستخدم",
  auth_password: "كلمة المرور",
  auth_email: "البريد الإلكتروني",
  auth_no_account: "ليس لديك حساب؟",
  auth_register: "سجّل",
  auth_create_account: "إنشاء حساب",
  auth_join_subtitle: "انضم إلى شبكة المراسلين المجتمعيين",
  auth_all_fields_required: "جميع الحقول مطلوبة",
  auth_enter_credentials: "أدخل اسم المستخدم وكلمة المرور",
  auth_invalid_credentials: "بيانات الاعتماد غير صحيحة",
  auth_registration_failed: "فشل التسجيل",
  auth_logout: "تسجيل الخروج",
  auth_demo_hint: "تجريبي: demo / wahatna2024",
  auth_full_name: "الاسم الكامل",
  auth_full_name_optional: "الاسم الكامل (اختياري)",

  home_greeting: "مرحباً",
  home_report_cta: "الإبلاغ عن خطر",
  home_my_reports: "بلاغاتي",
  home_view_all: "عرض الكل",
  home_no_reports_yet: "لا توجد بلاغات بعد",
  home_queued_offline: "بلاغ(ات) في الانتظار دون اتصال",
  home_heat_ban_title: "حظر العمل في الحر ساري",
  home_heat_ban_body: "يُحظر العمل في الخارج من 12:30 إلى 15:00 وفق لوائح وزارة الموارد البشرية.",
  home_safety: "تنبيه سلامة",
  home_language: "اللغة",

  report_title: "الإبلاغ عن خطر",
  report_step_category: "الفئة والتفاصيل",
  report_step_location: "الموقع",
  report_step_photos: "الصور",
  report_step_review: "المراجعة والإرسال",
  report_category_label: "فئة الخطر",
  report_description_label: "الوصف",
  report_description_placeholder: "صف الخطر بالتفصيل (20 حرفاً على الأقل)…",
  report_description_min: "يجب أن يكون الوصف 20 حرفاً على الأقل",
  report_phone_primary: "رقم الاتصال",
  report_phone_secondary: "رقم ثانوي (اختياري)",
  report_phone_placeholder: "مثال: 0501234567",
  report_next: "التالي",
  report_back: "رجوع",
  report_skip: "تخطي",
  report_submit: "إرسال البلاغ",
  report_submitting: "جارٍ الإرسال…",
  report_take_photo: "التقاط صورة",
  report_choose_library: "الاختيار من المكتبة",
  report_photos_optional: "الصور اختيارية لكنها تساعد في التقييم",

  cat_fire: "حريق",
  cat_flood: "فيضان",
  cat_road_damage: "تلف طريق",
  cat_electrical: "كهربائي",
  cat_heat_stress: "إجهاد حراري",
  cat_waste: "نفايات",
  cat_structural: "هيكلي",
  cat_other: "أخرى",

  loc_using_gps: "استخدام موقع GPS",
  loc_override_pin: "ضع دبوساً على الخريطة",
  loc_manual_address: "أدخل العنوان",
  loc_address_placeholder: "العنوان أو المعلم…",
  loc_gps_denied_ios: "الإعدادات ← الخصوصية ← خدمات الموقع ← واحتنا: السماح.",
  loc_gps_denied_android: "الإعدادات ← التطبيقات ← واحتنا ← الأذونات ← الموقع: السماح.",
  loc_gps_denied_web: "انقر على أيقونة الموقع في شريط العنوان بمتصفحك واسمح بالوصول.",
  loc_source_gps: "GPS",
  loc_source_pin: "دبوس خريطة",
  loc_source_address: "عنوان",

  confirm_title: "تم استلام البلاغ",
  confirm_body: "تم إرسال بلاغك وسيتم مراجعته من قِبل البلدية.",
  confirm_reference: "الرقم المرجعي",
  confirm_status: "الحالة",
  confirm_expected: "الرد المتوقع",
  confirm_track: "تتبع البلاغ",
  confirm_another: "الإبلاغ عن خطر آخر",

  my_reports_title: "بلاغاتي",
  my_reports_empty: "لا توجد بلاغات بعد. اضغط على 'الإبلاغ عن خطر' للبدء.",
  my_reports_loading: "جارٍ التحميل…",
  my_reports_updated: "تم تحديث البلاغات",
  my_reports_status_changed: "تم تحديث الحالة",
  my_reports_supervisor_notes: "ملاحظات المشرف",
  my_reports_timeline: "الجدول الزمني",
  my_reports_photos_attached: "تم إرفاق صورة",

  status_pending_review: "قيد المراجعة",
  status_under_review: "تحت المراجعة",
  status_assigned: "مُحال",
  status_completed: "مكتمل",
  status_rejected: "مرفوض",
  status_late: "متأخر",
  status_active: "نشط",

  sup_title: "لوحة المشرف",
  sup_access_restricted: "الوصول مقيد",
  sup_go_home: "العودة للرئيسية",
  sup_total: "الإجمالي",
  sup_pending: "قيد الانتظار",
  sup_under_review: "تحت المراجعة",
  sup_assigned: "محال",
  sup_completed: "مكتمل",
  sup_late: "متأخر",
  sup_critical: "حرج",
  sup_update_status: "تحديث الحالة",
  sup_add_note: "إضافة ملاحظة",
  sup_save_note: "حفظ الملاحظة",
  sup_rejection_reason: "سبب الرفض",
  sup_rejection_required: "سبب الرفض مطلوب",
  sup_escalated: "مُصعَّد",
  sup_due_in: "يستحق في",
  sup_overdue: "متأخر",
  sup_filter_status: "الحالة",
  sup_filter_severity: "الخطورة",
  sup_late_only: "المتأخرات فقط",
  sup_filter_date: "النطاق الزمني",
  sup_today: "اليوم",
  sup_this_week: "هذا الأسبوع",
  sup_all: "الكل",

  fleet_title: "الأسطول والمسارات",
  fleet_start_location: "نقطة الانطلاق",
  fleet_using_gps: "استخدام الموقع الحالي",
  fleet_transport_mode: "وسيلة النقل",
  fleet_walking: "مشياً",
  fleet_car: "سيارة",
  fleet_service_vehicle: "مركبة خدمة",
  fleet_walking_disclaimer: "مسار مشاة تقديري. قد يختلف الطريق الفعلي بسبب التضاريس أو القيود.",
  fleet_add_waypoint: "إضافة نقطة",
  fleet_optimize: "تحسين المسار",
  fleet_optimizing: "جارٍ التحسين…",
  fleet_original_order: "الترتيب الأصلي",
  fleet_optimized_route: "المسار المحسّن",
  fleet_distance_saved: "المسافة الموفرة",
  fleet_time_saved: "الوقت الموفر",
  fleet_priority_low: "منخفض",
  fleet_priority_medium: "متوسط",
  fleet_priority_high: "عالٍ",
  fleet_priority_critical: "حرج",
  fleet_priority_note: "تم تقديم المحطة الحرجة بسبب الأولوية العالية",

  heat_ban_title: "حظر العمل في الحر",
  heat_ban_body: "حظر وزارة الموارد البشرية: العمل في الخارج ممنوع 12:30–15:00 (15 يونيو–15 سبتمبر).",
  heat_ban_active: "الحظر ساري",
  heat_ban_inactive: "لا يوجد حظر",

  offline_banner: "غير متصل",
  offline_queued: "في الانتظار",
  offline_sync_pending: "جارٍ مزامنة البلاغات…",
  offline_emergency_warning: "للطوارئ التي تهدد الحياة اتصل بـ 999 فوراً.",
  offline_will_submit: "أنت غير متصل. سيُرسَل البلاغ عند عودة الاتصال.",

  err_generic: "حدث خطأ. يرجى المحاولة مرة أخرى.",
  err_field_required: "مطلوب",
  err_duplicate_report: "تم تقديم بلاغ مماثل خلال الخمس دقائق الماضية لهذا الموقع.",
  err_network: "خطأ في الشبكة. تحقق من الاتصال.",
  err_location: "تعذر الحصول على موقعك.",
  success_submitted: "تم إرسال البلاغ بنجاح.",
  success_saved: "تم الحفظ.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Urdu (RTL)
// ─────────────────────────────────────────────────────────────────────────────
const ur: Translations = {
  lang_name: "اردو",
  isRTL: true,

  nav_home: "ہوم",
  nav_report: "رپورٹ",
  nav_my_reports: "میری رپورٹیں",
  nav_fleet: "فلیٹ",
  nav_supervisor: "نگران",
  nav_reports: "رپورٹیں",

  auth_sign_in: "سائن ان",
  auth_sign_in_title: "واحتنا",
  auth_sign_in_subtitle: "القاع کمیونٹی سیفٹی",
  auth_username: "صارف نام",
  auth_password: "پاس ورڈ",
  auth_email: "ای میل",
  auth_no_account: "اکاؤنٹ نہیں ہے؟",
  auth_register: "رجسٹر کریں",
  auth_create_account: "اکاؤنٹ بنائیں",
  auth_join_subtitle: "کمیونٹی رپورٹرز نیٹ ورک میں شامل ہوں",
  auth_all_fields_required: "تمام خانے پُر کریں",
  auth_enter_credentials: "صارف نام اور پاس ورڈ درج کریں",
  auth_invalid_credentials: "غلط معلومات",
  auth_registration_failed: "رجسٹریشن ناکام",
  auth_logout: "لاگ آؤٹ",
  auth_demo_hint: "ڈیمو: demo / wahatna2024",
  auth_full_name: "پورا نام",
  auth_full_name_optional: "پورا نام (اختیاری)",

  home_greeting: "خوش آمدید",
  home_report_cta: "خطرے کی رپورٹ کریں",
  home_my_reports: "میری رپورٹیں",
  home_view_all: "سب دیکھیں",
  home_no_reports_yet: "ابھی تک کوئی رپورٹ نہیں",
  home_queued_offline: "رپورٹ(یں) آف لائن قطار میں",
  home_heat_ban_title: "گرمی کام پابندی فعال",
  home_heat_ban_body: "MOHRE قواعد کے تحت 12:30–15:00 بیرونی کام ممنوع ہے۔",
  home_safety: "حفاظتی الرٹ",
  home_language: "زبان",

  report_title: "خطرے کی رپورٹ",
  report_step_category: "قسم اور تفصیل",
  report_step_location: "مقام",
  report_step_photos: "تصاویر",
  report_step_review: "جائزہ اور ارسال",
  report_category_label: "خطرے کی قسم",
  report_description_label: "تفصیل",
  report_description_placeholder: "خطرے کی تفصیل بیان کریں (کم از کم 20 حروف)…",
  report_description_min: "تفصیل کم از کم 20 حروف ہونی چاہیے",
  report_phone_primary: "رابطہ نمبر",
  report_phone_secondary: "ثانوی نمبر (اختیاری)",
  report_phone_placeholder: "مثال: 0501234567",
  report_next: "اگلا",
  report_back: "واپس",
  report_skip: "چھوڑیں",
  report_submit: "رپورٹ بھیجیں",
  report_submitting: "بھیجا جا رہا ہے…",
  report_take_photo: "تصویر لیں",
  report_choose_library: "لائبریری سے منتخب کریں",
  report_photos_optional: "تصاویر اختیاری ہیں لیکن جائزے میں مددگار ہیں",

  cat_fire: "آگ",
  cat_flood: "سیلاب",
  cat_road_damage: "سڑک نقصان",
  cat_electrical: "بجلی",
  cat_heat_stress: "گرمی کا دباؤ",
  cat_waste: "فضلہ",
  cat_structural: "ساختی",
  cat_other: "دیگر",

  loc_using_gps: "GPS مقام استعمال ہو رہا ہے",
  loc_override_pin: "نقشے پر پن لگائیں",
  loc_manual_address: "پتہ درج کریں",
  loc_address_placeholder: "پتہ یا نشانی…",
  loc_gps_denied_ios: "سیٹنگز ← پرائیویسی ← لوکیشن سروسز ← واحتنا: اجازت دیں۔",
  loc_gps_denied_android: "سیٹنگز ← ایپس ← واحتنا ← اجازتیں ← مقام: اجازت دیں۔",
  loc_gps_denied_web: "براؤزر کے ایڈریس بار میں لوکیشن آئیکن کلک کر کے اجازت دیں۔",
  loc_source_gps: "GPS",
  loc_source_pin: "نقشہ پن",
  loc_source_address: "پتہ",

  confirm_title: "رپورٹ موصول",
  confirm_body: "آپ کی رپورٹ جمع ہو گئی۔ میونسپلٹی اس کا جائزہ لے گی۔",
  confirm_reference: "حوالہ",
  confirm_status: "حیثیت",
  confirm_expected: "متوقع جواب",
  confirm_track: "رپورٹ ٹریک کریں",
  confirm_another: "ایک اور خطرہ رپورٹ کریں",

  my_reports_title: "میری رپورٹیں",
  my_reports_empty: "ابھی تک کوئی رپورٹ نہیں۔ خطرے کی رپورٹ کریں کے بٹن کو ٹیپ کریں۔",
  my_reports_loading: "رپورٹیں لوڈ ہو رہی ہیں…",
  my_reports_updated: "رپورٹیں اپ ڈیٹ",
  my_reports_status_changed: "حیثیت اپ ڈیٹ",
  my_reports_supervisor_notes: "نگران نوٹس",
  my_reports_timeline: "ٹائم لائن",
  my_reports_photos_attached: "تصویر منسلک",

  status_pending_review: "جائزے کا انتظار",
  status_under_review: "زیر جائزہ",
  status_assigned: "تفویض",
  status_completed: "مکمل",
  status_rejected: "مسترد",
  status_late: "تاخیر",
  status_active: "فعال",

  sup_title: "نگران ڈیش بورڈ",
  sup_access_restricted: "رسائی محدود",
  sup_go_home: "ہوم پر جائیں",
  sup_total: "کل",
  sup_pending: "زیر التوا",
  sup_under_review: "زیر جائزہ",
  sup_assigned: "تفویض",
  sup_completed: "مکمل",
  sup_late: "تاخیر",
  sup_critical: "نازک",
  sup_update_status: "حیثیت اپ ڈیٹ",
  sup_add_note: "نوٹ شامل کریں",
  sup_save_note: "نوٹ محفوظ کریں",
  sup_rejection_reason: "مسترد کرنے کی وجہ",
  sup_rejection_required: "مسترد کرنے کی وجہ ضروری ہے",
  sup_escalated: "بڑھایا گیا",
  sup_due_in: "مقررہ وقت",
  sup_overdue: "تاخیر",
  sup_filter_status: "حیثیت",
  sup_filter_severity: "شدت",
  sup_late_only: "صرف تاخیری",
  sup_filter_date: "تاریخ کی حد",
  sup_today: "آج",
  sup_this_week: "اس ہفتے",
  sup_all: "سب",

  fleet_title: "فلیٹ اور راستے",
  fleet_start_location: "آغاز کا مقام",
  fleet_using_gps: "موجودہ مقام استعمال ہو رہا ہے",
  fleet_transport_mode: "نقل و حمل کا طریقہ",
  fleet_walking: "پیدل",
  fleet_car: "گاڑی",
  fleet_service_vehicle: "سروس گاڑی",
  fleet_walking_disclaimer: "تخمینی پیدل راستہ۔ زمینی حالات یا پابندیوں کی وجہ سے فرق ہو سکتا ہے۔",
  fleet_add_waypoint: "نقطہ شامل کریں",
  fleet_optimize: "راستہ بہتر بنائیں",
  fleet_optimizing: "بہتر بنایا جا رہا ہے…",
  fleet_original_order: "اصل ترتیب",
  fleet_optimized_route: "بہترین راستہ",
  fleet_distance_saved: "بچائی گئی دوری",
  fleet_time_saved: "بچایا گیا وقت",
  fleet_priority_low: "کم",
  fleet_priority_medium: "درمیانہ",
  fleet_priority_high: "زیادہ",
  fleet_priority_critical: "نازک",
  fleet_priority_note: "اعلی ترجیح کی وجہ سے نازک اسٹاپ آگے کیا گیا",

  heat_ban_title: "گرمی کام پابندی",
  heat_ban_body: "MOHRE پابندی: 12:30–15:00 بیرونی کام ممنوع (15 جون–15 ستمبر)۔",
  heat_ban_active: "پابندی فعال",
  heat_ban_inactive: "کوئی پابندی نہیں",

  offline_banner: "آف لائن",
  offline_queued: "قطار میں",
  offline_sync_pending: "رپورٹیں مطابقت پذیر ہو رہی ہیں…",
  offline_emergency_warning: "جان لیوا ہنگامی صورت میں فوری 999 پر کال کریں۔",
  offline_will_submit: "آپ آف لائن ہیں۔ رپورٹ انٹرنیٹ آنے پر بھیجی جائے گی۔",

  err_generic: "کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔",
  err_field_required: "ضروری",
  err_duplicate_report: "گزشتہ 5 منٹ میں اس مقام کے لیے ایک مماثل رپورٹ پہلے ہی جمع کی جا چکی ہے۔",
  err_network: "نیٹ ورک خرابی۔ کنیکشن چیک کریں۔",
  err_location: "آپ کا مقام نہیں مل سکا۔",
  success_submitted: "رپورٹ کامیابی سے جمع ہو گئی۔",
  success_saved: "محفوظ ہو گیا۔",
};

// ─────────────────────────────────────────────────────────────────────────────
// Hindi (LTR)
// ─────────────────────────────────────────────────────────────────────────────
const hi: Translations = {
  lang_name: "हिंदी",
  isRTL: false,

  nav_home: "होम",
  nav_report: "रिपोर्ट",
  nav_my_reports: "मेरी रिपोर्ट",
  nav_fleet: "फ्लीट",
  nav_supervisor: "पर्यवेक्षक",
  nav_reports: "रिपोर्टें",

  auth_sign_in: "साइन इन",
  auth_sign_in_title: "वाहतना",
  auth_sign_in_subtitle: "अल क़ुआ सामुदायिक सुरक्षा",
  auth_username: "उपयोगकर्ता नाम",
  auth_password: "पासवर्ड",
  auth_email: "ईमेल",
  auth_no_account: "अकाउंट नहीं है?",
  auth_register: "रजिस्टर करें",
  auth_create_account: "अकाउंट बनाएं",
  auth_join_subtitle: "सामुदायिक रिपोर्टर नेटवर्क में शामिल हों",
  auth_all_fields_required: "सभी फ़ील्ड आवश्यक हैं",
  auth_enter_credentials: "उपयोगकर्ता नाम और पासवर्ड दर्ज करें",
  auth_invalid_credentials: "गलत क्रेडेंशियल",
  auth_registration_failed: "पंजीकरण विफल",
  auth_logout: "लॉगआउट",
  auth_demo_hint: "डेमो: demo / wahatna2024",
  auth_full_name: "पूरा नाम",
  auth_full_name_optional: "पूरा नाम (वैकल्पिक)",

  home_greeting: "स्वागत है",
  home_report_cta: "खतरे की रिपोर्ट करें",
  home_my_reports: "मेरी रिपोर्ट",
  home_view_all: "सब देखें",
  home_no_reports_yet: "अभी तक कोई रिपोर्ट नहीं",
  home_queued_offline: "रिपोर्ट(ें) ऑफलाइन कतार में",
  home_heat_ban_title: "गर्मी कार्य प्रतिबंध सक्रिय",
  home_heat_ban_body: "MOHRE नियमों के तहत 12:30–15:00 बाहरी कार्य प्रतिबंधित है।",
  home_safety: "सुरक्षा अलर्ट",
  home_language: "भाषा",

  report_title: "खतरे की रिपोर्ट",
  report_step_category: "श्रेणी और विवरण",
  report_step_location: "स्थान",
  report_step_photos: "फ़ोटो",
  report_step_review: "समीक्षा और सबमिट",
  report_category_label: "खतरे की श्रेणी",
  report_description_label: "विवरण",
  report_description_placeholder: "खतरे का विस्तृत विवरण दें (कम से कम 20 अक्षर)…",
  report_description_min: "विवरण कम से कम 20 अक्षर होना चाहिए",
  report_phone_primary: "संपर्क नंबर",
  report_phone_secondary: "वैकल्पिक नंबर",
  report_phone_placeholder: "उदा. 0501234567",
  report_next: "अगला",
  report_back: "वापस",
  report_skip: "छोड़ें",
  report_submit: "रिपोर्ट सबमिट करें",
  report_submitting: "सबमिट हो रहा है…",
  report_take_photo: "फ़ोटो लें",
  report_choose_library: "लाइब्रेरी से चुनें",
  report_photos_optional: "फ़ोटो वैकल्पिक हैं लेकिन मूल्यांकन में सहायक हैं",

  cat_fire: "आग",
  cat_flood: "बाढ़",
  cat_road_damage: "सड़क क्षति",
  cat_electrical: "विद्युत",
  cat_heat_stress: "गर्मी का तनाव",
  cat_waste: "कचरा",
  cat_structural: "संरचनात्मक",
  cat_other: "अन्य",

  loc_using_gps: "GPS स्थान का उपयोग",
  loc_override_pin: "नक्शे पर पिन लगाएं",
  loc_manual_address: "पता दर्ज करें",
  loc_address_placeholder: "पता या स्थलचिह्न…",
  loc_gps_denied_ios: "सेटिंग्स ← गोपनीयता ← स्थान सेवाएं ← वाहतना: अनुमति दें।",
  loc_gps_denied_android: "सेटिंग्स ← ऐप्स ← वाहतना ← अनुमतियां ← स्थान: अनुमति दें।",
  loc_gps_denied_web: "ब्राउज़र के एड्रेस बार में स्थान आइकन क्लिक करें और अनुमति दें।",
  loc_source_gps: "GPS",
  loc_source_pin: "नक्शा पिन",
  loc_source_address: "पता",

  confirm_title: "रिपोर्ट प्राप्त",
  confirm_body: "आपकी रिपोर्ट सबमिट हो गई और नगरपालिका द्वारा समीक्षा की जाएगी।",
  confirm_reference: "संदर्भ",
  confirm_status: "स्थिति",
  confirm_expected: "अपेक्षित प्रतिक्रिया",
  confirm_track: "रिपोर्ट ट्रैक करें",
  confirm_another: "एक और खतरे की रिपोर्ट करें",

  my_reports_title: "मेरी रिपोर्ट",
  my_reports_empty: "अभी तक कोई रिपोर्ट नहीं। खतरे की रिपोर्ट करें बटन दबाएं।",
  my_reports_loading: "रिपोर्ट लोड हो रही हैं…",
  my_reports_updated: "रिपोर्ट अपडेट",
  my_reports_status_changed: "स्थिति अपडेट",
  my_reports_supervisor_notes: "पर्यवेक्षक नोट्स",
  my_reports_timeline: "टाइमलाइन",
  my_reports_photos_attached: "फ़ोटो संलग्न",

  status_pending_review: "समीक्षा प्रतीक्षित",
  status_under_review: "समीक्षाधीन",
  status_assigned: "सौंपा गया",
  status_completed: "पूर्ण",
  status_rejected: "अस्वीकृत",
  status_late: "विलंबित",
  status_active: "सक्रिय",

  sup_title: "पर्यवेक्षक डैशबोर्ड",
  sup_access_restricted: "पहुंच प्रतिबंधित",
  sup_go_home: "होम पर जाएं",
  sup_total: "कुल",
  sup_pending: "लंबित",
  sup_under_review: "समीक्षाधीन",
  sup_assigned: "सौंपा",
  sup_completed: "पूर्ण",
  sup_late: "विलंबित",
  sup_critical: "गंभीर",
  sup_update_status: "स्थिति अपडेट करें",
  sup_add_note: "नोट जोड़ें",
  sup_save_note: "नोट सहेजें",
  sup_rejection_reason: "अस्वीकृति का कारण",
  sup_rejection_required: "अस्वीकृति का कारण आवश्यक है",
  sup_escalated: "एस्केलेट",
  sup_due_in: "देय",
  sup_overdue: "विलंबित",
  sup_filter_status: "स्थिति",
  sup_filter_severity: "गंभीरता",
  sup_late_only: "केवल विलंबित",
  sup_filter_date: "तिथि सीमा",
  sup_today: "आज",
  sup_this_week: "इस सप्ताह",
  sup_all: "सब",

  fleet_title: "फ्लीट और मार्ग",
  fleet_start_location: "प्रारंभ स्थान",
  fleet_using_gps: "वर्तमान स्थान का उपयोग",
  fleet_transport_mode: "परिवहन का तरीका",
  fleet_walking: "पैदल",
  fleet_car: "कार",
  fleet_service_vehicle: "सर्विस वाहन",
  fleet_walking_disclaimer: "अनुमानित पैदल मार्ग। भूभाग या प्रतिबंधों के कारण भिन्न हो सकता है।",
  fleet_add_waypoint: "वेपॉइंट जोड़ें",
  fleet_optimize: "मार्ग अनुकूलित करें",
  fleet_optimizing: "अनुकूलित हो रहा है…",
  fleet_original_order: "मूल क्रम",
  fleet_optimized_route: "अनुकूलित मार्ग",
  fleet_distance_saved: "दूरी बची",
  fleet_time_saved: "समय बचा",
  fleet_priority_low: "कम",
  fleet_priority_medium: "मध्यम",
  fleet_priority_high: "उच्च",
  fleet_priority_critical: "गंभीर",
  fleet_priority_note: "उच्च प्राथमिकता के कारण गंभीर स्टॉप आगे किया गया",

  heat_ban_title: "गर्मी कार्य प्रतिबंध",
  heat_ban_body: "MOHRE प्रतिबंध: 12:30–15:00 बाहरी कार्य निषिद्ध (15 जून–15 सितंबर)।",
  heat_ban_active: "प्रतिबंध सक्रिय",
  heat_ban_inactive: "कोई प्रतिबंध नहीं",

  offline_banner: "ऑफलाइन",
  offline_queued: "कतार में",
  offline_sync_pending: "रिपोर्ट सिंक हो रही हैं…",
  offline_emergency_warning: "जानलेवा आपात स्थिति में तुरंत 999 पर कॉल करें।",
  offline_will_submit: "आप ऑफलाइन हैं। कनेक्शन आने पर रिपोर्ट सबमिट होगी।",

  err_generic: "कुछ गलत हुआ। फिर से प्रयास करें।",
  err_field_required: "आवश्यक",
  err_duplicate_report: "पिछले 5 मिनट में इस स्थान के लिए एक समान रिपोर्ट पहले ही जमा की जा चुकी है।",
  err_network: "नेटवर्क त्रुटि। कनेक्शन जांचें।",
  err_location: "आपका स्थान नहीं मिल सका।",
  success_submitted: "रिपोर्ट सफलतापूर्वक सबमिट हुई।",
  success_saved: "सहेजा गया।",
};

// ─────────────────────────────────────────────────────────────────────────────
// Dictionary map & helpers
// ─────────────────────────────────────────────────────────────────────────────

export const DICTIONARIES: Record<Language, Translations> = { en, ar, ur, hi };

export const LANGUAGE_OPTIONS: Array<{ code: Language; label: string; nativeLabel: string }> = [
  { code: "en", label: "English", nativeLabel: "EN" },
  { code: "ar", label: "Arabic",  nativeLabel: "ع" },
  { code: "ur", label: "Urdu",    nativeLabel: "اردو" },
  { code: "hi", label: "Hindi",   nativeLabel: "हि" },
];

/** Safe translator — falls back to English when a key is missing. */
export function translate(lang: Language, key: keyof Translations): string {
  const dict = DICTIONARIES[lang];
  const val = dict[key];
  if (typeof val === "string") return val;
  // fallback
  const fallback = DICTIONARIES["en"][key];
  return typeof fallback === "string" ? fallback : String(key);
}
