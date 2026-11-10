import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert, LayoutDashboard, MessageSquare, FileText, Bell, Users,
  BookOpen, CheckCircle2, AlertTriangle, XCircle, Send, Upload, Star,
  Download, Plus, Trash2, LogOut, UserCheck, Calendar, Mail, Award,
  RefreshCw, Eye, Check, X, GraduationCap, Building2, Clock
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, ReferenceLine, Cell
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// Helper: exact algebraic formula for consecutive classes needed to reach 75%
const calcClassesNeededFor75 = (attended, total) => {
  if (!total || total <= 0) return 0;
  return Math.max(0, 3 * total - 4 * attended);
};

const getBadgeColor = (pct) => {
  if (pct >= 80) return 'Green';
  if (pct >= 75) return 'Yellow';
  return 'Red';
};

export default function App() {
  // Authentication & Role State
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [loginForm, setLoginForm] = useState({ email: 'aarav@attendly.edu', password: 'student123' });
  const [registerForm, setRegisterForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'student',
    roll_or_emp_id: '',
    department_id: 1,
    year: 3,
    semester: 5,
    parent_name: '',
    parent_email: '',
  });

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState(null);

  // Core Application State (Seeded with Realistic College Data & Live Backend Sync)
  const [departments, setDepartments] = useState([
    { id: 1, name: 'Computer Science & Engineering', code: 'CSE', hod_name: 'Dr. Vikramaditya Rao' },
    { id: 2, name: 'Electronics & Communication', code: 'ECE', hod_name: 'Dr. Meenakshi Iyer' },
    { id: 3, name: 'Artificial Intelligence & Data Science', code: 'AI&DS', hod_name: 'Dr. Siddharth Menon' },
  ]);

  const [teachers, setTeachers] = useState([
    { id: 2, full_name: 'Prof. Ananya Deshmukh', email: 'ananya@attendly.edu', roll_or_emp_id: 'FAC-CSE-101', department_id: 1 },
    { id: 3, full_name: 'Dr. Karthik Subramanian', email: 'karthik@attendly.edu', roll_or_emp_id: 'FAC-CSE-102', department_id: 1 },
    { id: 4, full_name: 'Prof. Rohan Chatterjee', email: 'rohan@attendly.edu', roll_or_emp_id: 'FAC-CSE-103', department_id: 1 },
  ]);

  const [subjects, setSubjects] = useState([
    { id: 1, name: 'Database Management Systems', code: 'CS501', department_id: 1, semester: 5, teacher_id: 2, schedule_slot: '09:00 AM - 10:00 AM' },
    { id: 2, name: 'Operating Systems & Internals', code: 'CS502', department_id: 1, semester: 5, teacher_id: 3, schedule_slot: '10:15 AM - 11:15 AM' },
    { id: 3, name: 'Computer Networks & Security', code: 'CS503', department_id: 1, semester: 5, teacher_id: 4, schedule_slot: '11:30 AM - 12:30 PM' },
    { id: 4, name: 'Machine Learning Foundations', code: 'CS504', department_id: 1, semester: 5, teacher_id: 2, schedule_slot: '01:30 PM - 02:30 PM' },
    { id: 5, name: 'Software Engineering & Cloud', code: 'CS505', department_id: 1, semester: 5, teacher_id: 3, schedule_slot: '02:45 PM - 03:45 PM' },
  ]);

  const [students, setStudents] = useState([
    {
      student_id: 5,
      full_name: 'Aarav Sharma',
      roll_number: '21CSE042',
      email: 'aarav@attendly.edu',
      department_id: 1,
      department_name: 'Computer Science & Engineering',
      department_code: 'CSE',
      year: 3,
      semester: 5,
      parent_name: 'Suresh Sharma',
      parent_email: 'suresh.sharma@parentmail.com',
      parent_phone: '+91 98450 11223',
      notify_parent_email: true,
      notify_redline_alerts: true,
      subject_stats: [
        { subject_id: 1, attended: 14, total: 20 },
        { subject_id: 2, attended: 13, total: 20 },
        { subject_id: 3, attended: 13, total: 20 },
        { subject_id: 4, attended: 15, total: 20 },
        { subject_id: 5, attended: 13, total: 20 },
      ],
      monthly_reports: [
        { month: 'Sep 2026', conducted: 35, attended: 26, missed: 9, percentage: 74.3 },
        { month: 'Oct 2026', conducted: 35, attended: 24, missed: 11, percentage: 68.6 },
        { month: 'Nov 2026', conducted: 30, attended: 18, missed: 12, percentage: 60.0 },
      ],
    },
    {
      student_id: 6,
      full_name: 'Priya Nair',
      roll_number: '21CSE018',
      email: 'priya@attendly.edu',
      department_id: 1,
      department_name: 'Computer Science & Engineering',
      department_code: 'CSE',
      year: 3,
      semester: 5,
      parent_name: 'Venugopal Nair',
      parent_email: 'venugopal.nair@parentmail.com',
      parent_phone: '+91 98450 22334',
      notify_parent_email: true,
      notify_redline_alerts: true,
      subject_stats: [
        { subject_id: 1, attended: 19, total: 20 },
        { subject_id: 2, attended: 18, total: 20 },
        { subject_id: 3, attended: 18, total: 20 },
        { subject_id: 4, attended: 19, total: 20 },
        { subject_id: 5, attended: 18, total: 20 },
      ],
      monthly_reports: [
        { month: 'Sep 2026', conducted: 35, attended: 33, missed: 2, percentage: 94.3 },
        { month: 'Oct 2026', conducted: 35, attended: 32, missed: 3, percentage: 91.4 },
        { month: 'Nov 2026', conducted: 30, attended: 27, missed: 3, percentage: 90.0 },
      ],
    },
    {
      student_id: 7,
      full_name: 'Rohan Verma',
      roll_number: '21CSE055',
      email: 'rohan.v@attendly.edu',
      department_id: 1,
      department_name: 'Computer Science & Engineering',
      department_code: 'CSE',
      year: 3,
      semester: 5,
      parent_name: 'Mahesh Verma',
      parent_email: 'mahesh.verma@parentmail.com',
      parent_phone: '+91 98450 33445',
      notify_parent_email: true,
      notify_redline_alerts: true,
      subject_stats: [
        { subject_id: 1, attended: 15, total: 20 },
        { subject_id: 2, attended: 16, total: 20 },
        { subject_id: 3, attended: 15, total: 20 },
        { subject_id: 4, attended: 15, total: 20 },
        { subject_id: 5, attended: 15, total: 20 },
      ],
      monthly_reports: [
        { month: 'Sep 2026', conducted: 35, attended: 27, missed: 8, percentage: 77.1 },
        { month: 'Oct 2026', conducted: 35, attended: 26, missed: 9, percentage: 74.3 },
        { month: 'Nov 2026', conducted: 30, attended: 23, missed: 7, percentage: 76.7 },
      ],
    },
    {
      student_id: 8,
      full_name: 'Sneha Patel',
      roll_number: '21CSE063',
      email: 'sneha@attendly.edu',
      department_id: 1,
      department_name: 'Computer Science & Engineering',
      department_code: 'CSE',
      year: 3,
      semester: 5,
      parent_name: 'Kishore Patel',
      parent_email: 'kishore.patel@parentmail.com',
      parent_phone: '+91 98450 44556',
      notify_parent_email: true,
      notify_redline_alerts: true,
      subject_stats: [
        { subject_id: 1, attended: 13, total: 20 },
        { subject_id: 2, attended: 12, total: 20 },
        { subject_id: 3, attended: 13, total: 20 },
        { subject_id: 4, attended: 13, total: 20 },
        { subject_id: 5, attended: 13, total: 20 },
      ],
      monthly_reports: [
        { month: 'Sep 2026', conducted: 35, attended: 24, missed: 11, percentage: 68.6 },
        { month: 'Oct 2026', conducted: 35, attended: 22, missed: 13, percentage: 62.9 },
        { month: 'Nov 2026', conducted: 30, attended: 18, missed: 12, percentage: 60.0 },
      ],
    },
    {
      student_id: 9,
      full_name: 'Kavya Krishnan',
      roll_number: '21CSE029',
      email: 'kavya@attendly.edu',
      department_id: 1,
      department_name: 'Computer Science & Engineering',
      department_code: 'CSE',
      year: 3,
      semester: 5,
      parent_name: 'Ramesh Krishnan',
      parent_email: 'ramesh.krishnan@parentmail.com',
      parent_phone: '+91 98450 66778',
      notify_parent_email: true,
      notify_redline_alerts: true,
      subject_stats: [
        { subject_id: 1, attended: 14, total: 20 },
        { subject_id: 2, attended: 14, total: 20 },
        { subject_id: 3, attended: 15, total: 20 },
        { subject_id: 4, attended: 14, total: 20 },
        { subject_id: 5, attended: 14, total: 20 },
      ],
      monthly_reports: [
        { month: 'Sep 2026', conducted: 35, attended: 25, missed: 10, percentage: 71.4 },
        { month: 'Oct 2026', conducted: 35, attended: 25, missed: 10, percentage: 71.4 },
        { month: 'Nov 2026', conducted: 30, attended: 21, missed: 9, percentage: 70.0 },
      ],
    },
  ]);

  // Module 1: Consolidated Daily Parent Absence Alerts
  const [dailyAlerts, setDailyAlerts] = useState([
    {
      id: 101,
      student_id: 5,
      student_name: 'Aarav Sharma',
      roll_number: '21CSE042',
      department_name: 'Computer Science & Engineering',
      year: 3,
      absence_date: '2026-11-09',
      parent_email: 'suresh.sharma@parentmail.com',
      total_classes_scheduled: 5,
      total_classes_absent: 5,
      attendance_status: 'Full-Day Absent (5/5 Classes Missed)',
      delivery_status: 'Sent (1 Consolidated Daily Email)',
      sent_at: '2026-11-09 16:30',
      email_subject: '[ATTENDLY Consolidated Daily Alert] Full-Day Absence Notice - Aarav Sharma (2026-11-09)',
      email_body: `Dear Suresh Sharma,\n\nThis is an automated consolidated end-of-day attendance notification from ATTENDLY.\n\nStudent Name      : Aarav Sharma (21CSE042)\nDate              : November 09, 2026\nDepartment        : Computer Science & Engineering\nAcademic Year     : Year 3 (Semester 5)\nAttendance Status : FULL-DAY ABSENT (5/5 scheduled classes missed)\n\nNote: Individual class absence emails were suppressed to send you a single consolidated daily summary.\n\nRegards,\nATTENDLY Academic Monitoring Cell`,
    },
    {
      id: 102,
      student_id: 8,
      student_name: 'Sneha Patel',
      roll_number: '21CSE063',
      department_name: 'Computer Science & Engineering',
      year: 3,
      absence_date: '2026-11-05',
      parent_email: 'kishore.patel@parentmail.com',
      total_classes_scheduled: 5,
      total_classes_absent: 5,
      attendance_status: 'Full-Day Absent (5/5 Classes Missed)',
      delivery_status: 'Sent (1 Consolidated Daily Email)',
      sent_at: '2026-11-05 16:30',
      email_subject: '[ATTENDLY Consolidated Daily Alert] Full-Day Absence Notice - Sneha Patel (2026-11-05)',
      email_body: `Dear Kishore Patel,\n\nThis is an automated consolidated end-of-day attendance notification from ATTENDLY.\n\nStudent Name      : Sneha Patel (21CSE063)\nDate              : November 05, 2026\nDepartment        : Computer Science & Engineering\nAcademic Year     : Year 3 (Semester 5)\nAttendance Status : FULL-DAY ABSENT (5/5 scheduled classes missed)\n\nRegards,\nATTENDLY Academic Monitoring Cell`,
    },
  ]);
  const [selectedEmailPreview, setSelectedEmailPreview] = useState(null);

  // Module 2: Student-Teacher Connect (Doubts + Bidirectional Ratings)
  const [doubts, setDoubts] = useState([
    {
      id: 1,
      student_id: 5,
      student_name: 'Aarav Sharma',
      student_roll: '21CSE042',
      subject_id: 1,
      subject_name: 'Database Management Systems',
      subject_code: 'CS501',
      teacher_id: 2,
      teacher_name: 'Prof. Ananya Deshmukh',
      title: 'B+ Tree Indexing vs Hash Indexing in PostgreSQL',
      description: 'Ma\'am, in Lecture 14 we discussed range queries on composite keys. Why does PostgreSQL default to B-Tree instead of Hash index for equality + range predicates?',
      attachment_name: 'btree_vs_hash_benchmark.pdf',
      status: 'Answered',
      teacher_reply: 'Great question, Aarav! B-Tree stores keys in sorted order, allowing O(log N) traversal for both equality and range queries (<, >, BETWEEN), whereas Hash indexes only support exact equality (=) lookups.',
      replied_at: '2026-11-09 14:20',
      created_at: '2026-11-09 11:05',
    },
    {
      id: 2,
      student_id: 6,
      student_name: 'Priya Nair',
      student_roll: '21CSE018',
      subject_id: 2,
      subject_name: 'Operating Systems & Internals',
      subject_code: 'CS502',
      teacher_id: 3,
      teacher_name: 'Dr. Karthik Subramanian',
      title: 'Deadlock Avoidance: Banker\'s Algorithm Safe Sequence',
      description: 'Sir, when multiple processes request resources simultaneously, how do we verify safe state if the Available vector changes mid-cycle?',
      attachment_name: 'bankers_matrix_work.png',
      status: 'Resolved',
      teacher_reply: 'Priya, each resource request is evaluated atomically using the Safety Algorithm before allocation is committed.',
      replied_at: '2026-11-08 17:10',
      created_at: '2026-11-08 10:30',
    },
    {
      id: 3,
      student_id: 8,
      student_name: 'Sneha Patel',
      student_roll: '21CSE063',
      subject_id: 4,
      subject_name: 'Machine Learning Foundations',
      subject_code: 'CS504',
      teacher_id: 2,
      teacher_name: 'Prof. Ananya Deshmukh',
      title: 'Overfitting in Gradient Boosted Trees vs Random Forest',
      description: 'Ma\'am, my validation loss starts increasing after 150 estimators in Gradient Boosting. Should I reduce learning_rate or max_depth first?',
      attachment_name: 'validation_loss_plot.png',
      status: 'Pending',
      teacher_reply: '',
      replied_at: null,
      created_at: '2026-11-10 09:45',
    },
  ]);

  const [ratings, setRatings] = useState([
    {
      id: 1,
      from_user_name: 'Aarav Sharma (Student)',
      to_user_name: 'Prof. Ananya Deshmukh',
      direction: 'student_to_teacher',
      subject_name: 'Database Management Systems',
      metric_1_score: 5,
      metric_2_score: 5,
      metric_3_score: 5,
      overall_score: 5.0,
      comment: 'Explains complex DBMS indexing and query optimization with real production benchmarks!',
      created_at: '2026-11-09',
    },
    {
      id: 2,
      from_user_name: 'Prof. Ananya Deshmukh (Faculty)',
      to_user_name: 'Aarav Sharma',
      direction: 'teacher_to_student',
      subject_name: 'Database Management Systems',
      metric_1_score: 4,
      metric_2_score: 4,
      metric_3_score: 5,
      overall_score: 4.33,
      comment: 'Aarav asks insightful questions in DBMS lab, but needs to improve morning lecture attendance to clear the 75% Red Line.',
      created_at: '2026-11-09',
    },
    {
      id: 3,
      from_user_name: 'Dr. Karthik Subramanian (Faculty)',
      to_user_name: 'Priya Nair',
      direction: 'teacher_to_student',
      subject_name: 'Operating Systems & Internals',
      metric_1_score: 5,
      metric_2_score: 5,
      metric_3_score: 5,
      overall_score: 5.0,
      comment: 'Exemplary participation, discipline, and 92% attendance record.',
      created_at: '2026-11-08',
    },
  ]);

  // Module 4: RED LINE Notifications
  const [redlineLogs, setRedlineLogs] = useState([
    {
      id: 1,
      student_id: 5,
      student_name: 'Aarav Sharma',
      roll_number: '21CSE042',
      notification_type: 'WARNING_BELOW_75',
      attendance_percentage: 68.0,
      classes_needed: 28,
      message: 'RED LINE WARNING: Your overall attendance is 68.0% (below the mandatory 75% requirement). You must attend 28 additional consecutive classes to reach 75%.',
      created_at: '2026-11-10 08:30',
    },
    {
      id: 2,
      student_id: 8,
      student_name: 'Sneha Patel',
      roll_number: '21CSE063',
      notification_type: 'WARNING_BELOW_75',
      attendance_percentage: 64.0,
      classes_needed: 44,
      message: 'RED LINE WARNING: Your overall attendance is 64.0% (below 75%). You need 44 consecutive classes to recover.',
      created_at: '2026-11-10 08:30',
    },
  ]);

  // Module 5: Student Attendance Issue & Leave Explanation
  const [leaveRequests, setLeaveRequests] = useState([
    {
      id: 1,
      student_id: 5,
      student_name: 'Aarav Sharma',
      roll_number: '21CSE042',
      subject_id: 1,
      subject_name: 'Database Management Systems',
      absence_date: '2026-11-09',
      reason_category: 'Medical Emergency',
      explanation_text: 'Had acute viral fever and visited Apollo Clinic for blood work and physician consultation. Medical certificate attached for verification.',
      document_name: 'apollo_medical_certificate_nov9.pdf',
      status: 'Pending',
      reviewer_name: null,
      reviewer_comment: '',
      convert_to_present: false,
      created_at: '2026-11-09 18:15',
    },
    {
      id: 2,
      student_id: 8,
      student_name: 'Sneha Patel',
      roll_number: '21CSE063',
      subject_id: 3,
      subject_name: 'Computer Networks & Security',
      absence_date: '2026-11-05',
      reason_category: 'Family Emergency',
      explanation_text: 'Had to travel out of station with family due to an urgent family medical situation.',
      document_name: 'parent_signed_letter.pdf',
      status: 'Approved',
      reviewer_name: 'Prof. Ananya Deshmukh',
      reviewer_comment: 'Verified parent letter. Explanation recorded on file; per college policy, attendance remains unchanged unless medical condonation is checked.',
      convert_to_present: false,
      created_at: '2026-11-06 10:00',
    },
  ]);

  // Forms State across Modules
  const [newDoubt, setNewDoubt] = useState({ subject_id: 1, title: '', description: '', fileName: '' });
  const [doubtFilter, setDoubtFilter] = useState('All');
  const [replyTextMap, setReplyTextMap] = useState({});
  const [newRating, setNewRating] = useState({
    target_id: 2,
    subject_id: 1,
    metric_1: 5,
    metric_2: 5,
    metric_3: 5,
    comment: '',
  });
  const [newLeave, setNewLeave] = useState({
    absence_date: '2026-11-10',
    subject_id: 1,
    reason_category: 'Medical Emergency',
    explanation_text: '',
    document_name: '',
  });
  const [reviewModal, setReviewModal] = useState(null);
  const [markSheetSubjectId, setMarkSheetSubjectId] = useState(1);
  const [markSheetDate, setMarkSheetDate] = useState('2026-11-10');
  const [markSheetStatus, setMarkSheetStatus] = useState({
    5: 'Absent',
    6: 'Present',
    7: 'Present',
    8: 'Absent',
    9: 'Present',
  });
  const [simExtraClasses, setSimExtraClasses] = useState(10);
  const [newUserForm, setNewUserForm] = useState({
    full_name: '',
    email: '',
    roll_or_emp_id: '',
    role: 'student',
    parent_email: '',
  });
  const [newSubjectForm, setNewSubjectForm] = useState({
    name: '',
    code: '',
    semester: 5,
    teacher_id: 2,
    schedule_slot: '03:45 PM - 04:45 PM',
  });

  const showNotification = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Compute enriched student summaries with accurate attendance math
  const enrichedStudents = useMemo(() => {
    return students.map((st) => {
      const total_classes = st.subject_stats.reduce((acc, s) => acc + s.total, 0);
      const attended_classes = st.subject_stats.reduce((acc, s) => acc + s.attended, 0);
      const missed_classes = total_classes - attended_classes;
      const overall_percentage = total_classes > 0 ? Number(((attended_classes / total_classes) * 100).toFixed(2)) : 100;
      const classes_needed_for_75 = calcClassesNeededFor75(attended_classes, total_classes);
      const status_color = getBadgeColor(overall_percentage);

      const subject_breakdown = st.subject_stats.map((ss) => {
        const subj = subjects.find((sub) => sub.id === ss.subject_id) || subjects[0];
        const teacher = teachers.find((t) => t.id === subj?.teacher_id);
        const pct = ss.total > 0 ? Number(((ss.attended / ss.total) * 100).toFixed(1)) : 100;
        return {
          subject_id: ss.subject_id,
          subject_name: subj ? subj.name : 'Subject',
          subject_code: subj ? subj.code : 'CS500',
          schedule_slot: subj ? subj.schedule_slot : '09:00 AM',
          teacher_name: teacher ? teacher.full_name : 'Faculty',
          total_classes: ss.total,
          attended: ss.attended,
          missed: ss.total - ss.attended,
          percentage: pct,
          status_color: getBadgeColor(pct),
          classes_needed_for_75: calcClassesNeededFor75(ss.attended, ss.total),
        };
      });

      return {
        ...st,
        total_classes,
        attended_classes,
        missed_classes,
        overall_percentage,
        classes_needed_for_75,
        status_color,
        is_redline: overall_percentage < 75.0,
        subject_breakdown,
      };
    });
  }, [students, subjects, teachers]);

  // Active Student Profile (either logged-in student or selected student)
  const [selectedStudentId, setSelectedStudentId] = useState(5);
  const activeStudent = useMemo(() => {
    if (currentUser?.role === 'student') {
      return enrichedStudents.find((s) => s.email === currentUser.email) || enrichedStudents[0];
    }
    return enrichedStudents.find((s) => s.student_id === selectedStudentId) || enrichedStudents[0];
  }, [currentUser, enrichedStudents, selectedStudentId]);

  // Handle Login & Quick Role Switching
  const handleLogin = (e) => {
    e.preventDefault();
    const email = loginForm.email.trim().toLowerCase();
    if (email === 'admin@attendly.edu') {
      setCurrentUser({ id: 1, full_name: 'Dr. Rajeshwari Kulkarni (Dean Academics)', email, role: 'admin', roll_or_emp_id: 'ADM-001' });
      setActiveTab('admin');
      showNotification('Logged in as Administrator (Full System Access)');
      return;
    }
    const foundTeacher = teachers.find((t) => t.email.toLowerCase() === email);
    if (foundTeacher) {
      setCurrentUser({ ...foundTeacher, role: 'teacher' });
      setActiveTab('admin');
      showNotification(`Welcome back, ${foundTeacher.full_name} (Faculty Portal)`);
      return;
    }
    const foundStudent = enrichedStudents.find((s) => s.email.toLowerCase() === email);
    if (foundStudent) {
      setCurrentUser({
        id: foundStudent.student_id,
        full_name: foundStudent.full_name,
        email: foundStudent.email,
        role: 'student',
        roll_or_emp_id: foundStudent.roll_number,
      });
      setSelectedStudentId(foundStudent.student_id);
      setActiveTab('dashboard');
      showNotification(`Welcome, ${foundStudent.full_name}!`);
      return;
    }
    showNotification('Invalid credentials. Use one of the demo role buttons below for instant login!', 'error');
  };

  const handleQuickRoleSwitch = (roleType, email) => {
    setLoginForm({ email, password: `${roleType}123` });
    if (roleType === 'admin') {
      setCurrentUser({ id: 1, full_name: 'Dr. Rajeshwari Kulkarni (Dean Academics)', email: 'admin@attendly.edu', role: 'admin', roll_or_emp_id: 'ADM-001' });
      setActiveTab('admin');
    } else if (roleType === 'teacher') {
      const t = teachers[0];
      setCurrentUser({ ...t, role: 'teacher' });
      setActiveTab('admin');
    } else {
      const st = enrichedStudents.find((s) => s.email === email) || enrichedStudents[0];
      setCurrentUser({ id: st.student_id, full_name: st.full_name, email: st.email, role: 'student', roll_or_emp_id: st.roll_number });
      setSelectedStudentId(st.student_id);
      setActiveTab('dashboard');
    }
    showNotification(`Switched active role to ${roleType.toUpperCase()}`);
  };

  const handleRegister = (e) => {
    e.preventDefault();
    if (!registerForm.full_name || !registerForm.email || !registerForm.roll_or_emp_id) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }
    if (registerForm.role === 'student') {
      const newId = Date.now();
      const newSt = {
        student_id: newId,
        full_name: registerForm.full_name,
        roll_number: registerForm.roll_or_emp_id,
        email: registerForm.email.toLowerCase(),
        department_id: 1,
        department_name: 'Computer Science & Engineering',
        department_code: 'CSE',
        year: Number(registerForm.year) || 3,
        semester: Number(registerForm.semester) || 5,
        parent_name: registerForm.parent_name || 'Guardian',
        parent_email: registerForm.parent_email || 'parent@example.com',
        parent_phone: '+91 98000 00000',
        notify_parent_email: true,
        notify_redline_alerts: true,
        subject_stats: subjects.map((sub) => ({ subject_id: sub.id, attended: 16, total: 20 })),
        monthly_reports: [
          { month: 'Sep 2026', conducted: 35, attended: 28, missed: 7, percentage: 80.0 },
          { month: 'Oct 2026', conducted: 35, attended: 28, missed: 7, percentage: 80.0 },
          { month: 'Nov 2026', conducted: 30, attended: 24, missed: 6, percentage: 80.0 },
        ],
      };
      setStudents((prev) => [...prev, newSt]);
      setCurrentUser({ id: newId, full_name: newSt.full_name, email: newSt.email, role: 'student', roll_or_emp_id: newSt.roll_number });
      setSelectedStudentId(newId);
      setActiveTab('dashboard');
      showNotification('Student account registered and logged in!');
    } else {
      const newT = {
        id: Date.now(),
        full_name: registerForm.full_name,
        email: registerForm.email.toLowerCase(),
        roll_or_emp_id: registerForm.roll_or_emp_id,
        department_id: 1,
      };
      setTeachers((prev) => [...prev, newT]);
      setCurrentUser({ ...newT, role: registerForm.role });
      setActiveTab('admin');
      showNotification(`${registerForm.role.toUpperCase()} account registered and logged in!`);
    }
  };

  // Module 1 Handler: Trigger Full-Day Attendance Scan & Consolidated Parent Alert
  const handleRunFullDayAlertScan = () => {
    const absentAllDayStudents = enrichedStudents.filter((s) => markSheetStatus[s.student_id] === 'Absent');
    let createdCount = 0;

    absentAllDayStudents.forEach((st) => {
      const alreadyExists = dailyAlerts.some(
        (a) => a.student_id === st.student_id && a.absence_date === markSheetDate
      );
      if (!alreadyExists && st.notify_parent_email) {
        createdCount += 1;
        const newAlert = {
          id: Date.now() + st.student_id,
          student_id: st.student_id,
          student_name: st.full_name,
          roll_number: st.roll_number,
          department_name: st.department_name,
          year: st.year,
          absence_date: markSheetDate,
          parent_email: st.parent_email,
          total_classes_scheduled: subjects.length,
          total_classes_absent: subjects.length,
          attendance_status: `Full-Day Absent (${subjects.length}/${subjects.length} Classes Missed)`,
          delivery_status: 'Sent (1 Consolidated Daily Email)',
          sent_at: `${markSheetDate} 16:45`,
          email_subject: `[ATTENDLY Consolidated Daily Alert] Full-Day Absence Notice - ${st.full_name} (${markSheetDate})`,
          email_body: `Dear ${st.parent_name || 'Parent/Guardian'},\n\nThis is an automated consolidated end-of-day attendance notification from ATTENDLY.\n\nStudent Name      : ${st.full_name} (${st.roll_number})\nDate              : ${markSheetDate}\nDepartment        : ${st.department_name}\nAcademic Year     : Year ${st.year} (Semester ${st.semester})\nAttendance Status : FULL-DAY ABSENT (${subjects.length}/${subjects.length} classes missed)\n\nNote: Separate per-period emails were suppressed. Only ONE consolidated daily notification is generated per student.\n\nRegards,\nATTENDLY Academic Monitoring Cell`,
        };
        setDailyAlerts((prev) => [newAlert, ...prev]);
      }
    });

    if (createdCount > 0) {
      showNotification(`Generated ${createdCount} consolidated daily parent email notification(s) for ${markSheetDate}!`);
    } else {
      showNotification(`Consolidated scan verified for ${markSheetDate}: No new unnotified full-day absences (duplicate emails prevented).`);
    }
  };

  // Module 2 Handlers: Post Doubt, Reply, Rate
  const handlePostDoubt = (e) => {
    e.preventDefault();
    if (!newDoubt.title || !newDoubt.description) {
      showNotification('Please enter both a doubt title and description', 'error');
      return;
    }
    const subj = subjects.find((s) => s.id === Number(newDoubt.subject_id)) || subjects[0];
    const teacher = teachers.find((t) => t.id === subj.teacher_id) || teachers[0];
    const item = {
      id: Date.now(),
      student_id: activeStudent.student_id,
      student_name: activeStudent.full_name,
      student_roll: activeStudent.roll_number,
      subject_id: subj.id,
      subject_name: subj.name,
      subject_code: subj.code,
      teacher_id: teacher.id,
      teacher_name: teacher.full_name,
      title: newDoubt.title,
      description: newDoubt.description,
      attachment_name: newDoubt.fileName || null,
      status: 'Pending',
      teacher_reply: '',
      replied_at: null,
      created_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };
    setDoubts((prev) => [item, ...prev]);
    setNewDoubt({ subject_id: 1, title: '', description: '', fileName: '' });
    showNotification('Doubt submitted to faculty!');
  };

  const handleTeacherReplyDoubt = (doubtId, newStatus = 'Answered') => {
    const replyText = replyTextMap[doubtId];
    if (!replyText || !replyText.trim()) {
      showNotification('Please type a response before submitting', 'error');
      return;
    }
    setDoubts((prev) =>
      prev.map((d) =>
        d.id === doubtId
          ? {
              ...d,
              teacher_reply: replyText,
              status: newStatus,
              replied_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
            }
          : d
      )
    );
    showNotification(`Doubt #${doubtId} marked as ${newStatus}`);
  };

  const handleMarkDoubtResolved = (doubtId) => {
    setDoubts((prev) => prev.map((d) => (d.id === doubtId ? { ...d, status: 'Resolved' } : d)));
    showNotification('Doubt status updated to Resolved!');
  };

  const handleSubmitRating = (e) => {
    e.preventDefault();
    const isStudent = currentUser.role === 'student';
    const direction = isStudent ? 'student_to_teacher' : 'teacher_to_student';
    const targetObj = isStudent
      ? teachers.find((t) => t.id === Number(newRating.target_id)) || teachers[0]
      : enrichedStudents.find((s) => s.student_id === Number(newRating.target_id)) || enrichedStudents[0];
    const subj = subjects.find((s) => s.id === Number(newRating.subject_id)) || subjects[0];
    const overall = Number(((Number(newRating.metric_1) + Number(newRating.metric_2) + Number(newRating.metric_3)) / 3).toFixed(2));

    const entry = {
      id: Date.now(),
      from_user_name: `${currentUser.full_name} (${currentUser.role === 'student' ? 'Student' : 'Faculty'})`,
      to_user_name: targetObj.full_name,
      direction,
      subject_name: subj.name,
      metric_1_score: Number(newRating.metric_1),
      metric_2_score: Number(newRating.metric_2),
      metric_3_score: Number(newRating.metric_3),
      overall_score: overall,
      comment: newRating.comment || 'Consistent academic engagement and constructive interaction.',
      created_at: new Date().toISOString().slice(0, 10),
    };
    setRatings((prev) => [entry, ...prev]);
    setNewRating((prev) => ({ ...prev, comment: '' }));
    showNotification(`Feedback & ${overall}/5 rating submitted for ${targetObj.full_name}!`);
  };

  // Module 5 Handlers: Submit & Review Leave Explanation
  const handleSubmitLeaveExplanation = (e) => {
    e.preventDefault();
    if (!newLeave.explanation_text.trim()) {
      showNotification('Please provide a detailed explanation for your absence', 'error');
      return;
    }
    const subj = subjects.find((s) => s.id === Number(newLeave.subject_id));
    const entry = {
      id: Date.now(),
      student_id: activeStudent.student_id,
      student_name: activeStudent.full_name,
      roll_number: activeStudent.roll_number,
      subject_id: subj ? subj.id : null,
      subject_name: subj ? subj.name : 'Full Day / All Subjects',
      absence_date: newLeave.absence_date,
      reason_category: newLeave.reason_category,
      explanation_text: newLeave.explanation_text,
      document_name: newLeave.document_name || 'medical_supporting_doc.pdf',
      status: 'Pending',
      reviewer_name: null,
      reviewer_comment: '',
      convert_to_present: false,
      created_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };
    setLeaveRequests((prev) => [entry, ...prev]);
    setNewLeave({
      absence_date: '2026-11-10',
      subject_id: 1,
      reason_category: 'Medical Emergency',
      explanation_text: '',
      document_name: '',
    });
    showNotification('Absence explanation submitted (Status: Pending). Attendance remains unchanged until authorized review.');
  };

  const handleFinalizeLeaveReview = (decisionStatus, convertAttendance) => {
    if (!reviewModal) return;
    setLeaveRequests((prev) =>
      prev.map((lv) =>
        lv.id === reviewModal.id
          ? {
              ...lv,
              status: decisionStatus,
              reviewer_name: currentUser.full_name,
              reviewer_comment:
                reviewModal.reviewer_comment ||
                (decisionStatus === 'Approved'
                  ? 'Supporting documents verified by faculty.'
                  : 'Insufficient supporting documentation.'),
              convert_to_present: decisionStatus === 'Approved' ? convertAttendance : false,
            }
          : lv
      )
    );

    if (decisionStatus === 'Approved' && convertAttendance) {
      setStudents((prev) =>
        prev.map((st) => {
          if (st.student_id !== reviewModal.student_id) return st;
          return {
            ...st,
            subject_stats: st.subject_stats.map((ss) =>
              ss.subject_id === reviewModal.subject_id
                ? { ...ss, attended: Math.min(ss.total, ss.attended + 1) }
                : ss
            ),
          };
        })
      );
      showNotification(`Request Approved AND Absent record converted to Present per college condonation policy!`);
    } else {
      showNotification(`Request marked as ${decisionStatus}. Student notified (Attendance count unchanged per policy).`);
    }
    setReviewModal(null);
  };

  // Module 6 Handlers: Mark Class Attendance, Export PDF/Excel, Manage Users/Subjects
  const handleMarkClassAttendanceSubmit = () => {
    const subj = subjects.find((s) => s.id === Number(markSheetSubjectId)) || subjects[0];
    const newAlerts = [];

    setStudents((prev) =>
      prev.map((st) => {
        const statusVal = markSheetStatus[st.student_id] || 'Present';
        const oldTotal = st.subject_stats.reduce((a, b) => a + b.total, 0);
        const oldAtt = st.subject_stats.reduce((a, b) => a + b.attended, 0);
        const oldPct = (oldAtt / oldTotal) * 100;

        const updatedStats = st.subject_stats.map((ss) =>
          ss.subject_id === subj.id
            ? {
                ...ss,
                total: ss.total + 1,
                attended: statusVal === 'Present' ? ss.attended + 1 : ss.attended,
              }
            : ss
        );

        const newTotal = updatedStats.reduce((a, b) => a + b.total, 0);
        const newAtt = updatedStats.reduce((a, b) => a + b.attended, 0);
        const newPct = Number(((newAtt / newTotal) * 100).toFixed(2));
        const needed = calcClassesNeededFor75(newAtt, newTotal);

        if (newPct < 75.0) {
          newAlerts.push({
            id: Date.now() + st.student_id,
            student_id: st.student_id,
            student_name: st.full_name,
            roll_number: st.roll_number,
            notification_type: 'WARNING_BELOW_75',
            attendance_percentage: newPct,
            classes_needed: needed,
            message: `RED LINE WARNING: Your attendance is now ${newPct}% after ${subj.code}. Attend ${needed} consecutive classes to reach 75%.`,
            created_at: `${markSheetDate} 15:00`,
          });
        } else if (oldPct < 75.0 && newPct >= 75.0) {
          newAlerts.push({
            id: Date.now() + st.student_id,
            student_id: st.student_id,
            student_name: st.full_name,
            roll_number: st.roll_number,
            notification_type: 'RECOVERY_ABOVE_75',
            attendance_percentage: newPct,
            classes_needed: 0,
            message: `RED LINE CLEARED: Congratulations ${st.full_name}! Your attendance recovered to ${newPct}% (>= 75%).`,
            created_at: `${markSheetDate} 15:00`,
          });
        }

        return { ...st, subject_stats: updatedStats };
      })
    );

    if (newAlerts.length > 0) {
      setRedlineLogs((prev) => [...newAlerts, ...prev]);
    }
    showNotification(`Attendance saved for ${subj.name} (${markSheetDate})! Percentages & RED LINE alerts updated.`);
  };

  const handleDownloadReport = (format) => {
    if (format === 'excel') {
      const headers = [
        'Roll Number,Student Name,Department,Semester,Total Classes,Attended,Missed,Attendance %,Status Badge,RED LINE Status,Classes Needed for 75%,Parent Email',
      ];
      const rows = enrichedStudents.map(
        (s) =>
          `${s.roll_number},"${s.full_name}",${s.department_code},${s.semester},${s.total_classes},${s.attended_classes},${s.missed_classes},${s.overall_percentage}%,${s.status_color},${
            s.is_redline ? 'BELOW 75% (RED LINE)' : 'SAFE (>=75%)'
          },${s.classes_needed_for_75},${s.parent_email}`
      );
      const csvString = [headers, ...rows].join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ATTENDLY_Attendance_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showNotification('Downloaded Excel/CSV Attendance Report!');
    } else {
      window.open(`${API_BASE}/admin/reports/export?format=pdf`, '_blank');
      showNotification('Triggered PDF Attendance Report download!');
    }
  };

  // ============================================================================
  // LOGIN & REGISTRATION SCREEN
  // ============================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="max-w-5xl w-full grid md:grid-cols-12 bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-800/20">
          {/* Left Branding Panel */}
          <div className="md:col-span-5 bg-slate-900 text-white p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-600/40">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight">ATTENDLY</h1>
                  <p className="text-xs text-purple-300 font-medium">Smart College Attendance System</p>
                </div>
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold leading-snug mb-4">
                Transparent, Automated & Student-Friendly Attendance.
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed mb-6">
                Featuring Consolidated Full-Day Parent Email Alerts, the 75% RED LINE Warning & Recovery Engine, Interactive Student-Teacher Connect, and Medical Leave Workflows.
              </p>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-center gap-2.5 bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                  <Mail className="w-4 h-4 text-purple-400 shrink-0" />
                  <span><strong>1 Consolidated Daily Email:</strong> Zero per-class spam; alerts parents only on full-day absence.</span>
                </div>
                <div className="flex items-center gap-2.5 bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span><strong>RED LINE 75% Tracker:</strong> Exact class recovery calculator & automated warnings.</span>
                </div>
                <div className="flex items-center gap-2.5 bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                  <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>2-Way Connect & Ratings:</strong> Subject doubts with attachments + mutual feedback.</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-8 pt-6 border-t border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-300 mb-3">
                1-Click Presentation Demo Login
              </p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickRoleSwitch('student', 'aarav@attendly.edu')}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-xs flex items-center justify-between transition"
                >
                  <span><strong>Student (RED LINE 68%):</strong> Aarav Sharma</span>
                  <span className="px-2 py-0.5 rounded bg-rose-500 text-white font-bold">Demo &rarr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickRoleSwitch('student', 'priya@attendly.edu')}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-xs flex items-center justify-between transition"
                >
                  <span><strong>Student (Green 92%):</strong> Priya Nair</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold">Demo &rarr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickRoleSwitch('teacher', 'ananya@attendly.edu')}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 text-xs flex items-center justify-between transition"
                >
                  <span><strong>Faculty Role:</strong> Prof. Ananya Deshmukh</span>
                  <span className="px-2 py-0.5 rounded bg-purple-600 text-white font-bold">Demo &rarr;</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickRoleSwitch('admin', 'admin@attendly.edu')}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-xs flex items-center justify-between transition"
                >
                  <span><strong>Admin Role:</strong> Dr. Rajeshwari Kulkarni</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold">Demo &rarr;</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="md:col-span-7 p-8 lg:p-12 flex flex-col justify-center">
            <div className="flex gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition ${
                  authMode === 'login' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition ${
                  authMode === 'register' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Sign in to ATTENDLY</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Access your role-based Student, Faculty, or Administrator portal.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">College Email Address</label>
                  <input
                    type="email"
                    required
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 focus:outline-none text-sm"
                    placeholder="aarav@attendly.edu"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">Password</label>
                  <input
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-purple-600 focus:outline-none text-sm"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-purple-700 text-white font-semibold text-sm shadow-lg transition"
                >
                  Login to Portal
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Register New Account</h3>
                  <p className="text-sm text-slate-500 mt-1">Enroll as a Student, Faculty Member, or Administrator.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={registerForm.full_name}
                      onChange={(e) => setRegisterForm({ ...registerForm, full_name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                      placeholder="Neha Sharma"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Role</label>
                    <select
                      value={registerForm.role}
                      onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher / Faculty</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">College Email</label>
                    <input
                      type="email"
                      required
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                      placeholder="neha@attendly.edu"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Roll No / Employee ID</label>
                    <input
                      type="text"
                      required
                      value={registerForm.roll_or_emp_id}
                      onChange={(e) => setRegisterForm({ ...registerForm, roll_or_emp_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                      placeholder="21CSE088"
                    />
                  </div>
                </div>
                {registerForm.role === 'student' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Parent Name</label>
                      <input
                        type="text"
                        value={registerForm.parent_name}
                        onChange={(e) => setRegisterForm({ ...registerForm, parent_name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                        placeholder="Rajesh Sharma"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Parent Email (For Daily Alerts)</label>
                      <input
                        type="email"
                        value={registerForm.parent_email}
                        onChange={(e) => setRegisterForm({ ...registerForm, parent_email: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                        placeholder="parent@email.com"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                    placeholder="Create a strong password"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm shadow-lg transition"
                >
                  Complete Registration
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // NAVIGATION ITEMS (WITH ROLE-BASED ACCESS BADGES)
  // ============================================================================
  const navItems = [
    { id: 'dashboard', label: '3. Student Dashboard', icon: LayoutDashboard, roles: ['student', 'teacher', 'admin'] },
    { id: 'redline', label: '4. RED LINE (<75%)', icon: ShieldAlert, roles: ['student', 'teacher', 'admin'], badge: enrichedStudents.filter((s) => s.is_redline).length },
    { id: 'alerts', label: '1. Full-Day Parent Alerts', icon: Mail, roles: ['student', 'teacher', 'admin'], badge: dailyAlerts.length },
    { id: 'connect', label: '2. Student-Teacher Connect', icon: MessageSquare, roles: ['student', 'teacher', 'admin'], badge: doubts.filter((d) => d.status === 'Pending').length },
    { id: 'leaves', label: '5. Leave & Explanations', icon: FileText, roles: ['student', 'teacher', 'admin'], badge: leaveRequests.filter((l) => l.status === 'Pending').length },
    { id: 'admin', label: '6. Admin & Faculty Hub', icon: Users, roles: ['teacher', 'admin'] },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* LEFT NAVIGATION SIDEBAR (Navy Blue + Purple Accent Theme) */}
      <aside className="w-72 bg-slate-900 text-white flex flex-col justify-between shrink-0 shadow-xl">
        <div>
          {/* Brand Header */}
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center shadow-md shadow-purple-600/30">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-wide">ATTENDLY</h1>
              <p className="text-[11px] text-purple-300">Smart Attendance Suite</p>
            </div>
          </div>

          {/* Active User Card */}
          <div className="p-4 mx-4 mt-4 rounded-2xl bg-slate-800/90 border border-slate-700/80">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-600 text-white">
                {currentUser.role} Portal
              </span>
              <span className="text-xs text-slate-400 font-mono">{currentUser.roll_or_emp_id}</span>
            </div>
            <p className="font-bold text-sm truncate mt-1">{currentUser.full_name}</p>
            <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
          </div>

          {/* Navigation Menu */}
          <nav className="p-4 space-y-1.5">
            {navItems
              .filter((item) => item.roles.includes(currentUser.role))
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge > 0 && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          isActive ? 'bg-white text-purple-700' : 'bg-slate-700 text-purple-200'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>
        </div>

        {/* Presentation Role Switcher & Logout Footer */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700">
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-300 mb-2">
              Presentation Quick Role Switch
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => handleQuickRoleSwitch('student', 'aarav@attendly.edu')}
                className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                  currentUser.role === 'student' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Student
              </button>
              <button
                onClick={() => handleQuickRoleSwitch('teacher', 'ananya@attendly.edu')}
                className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                  currentUser.role === 'teacher' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Teacher
              </button>
              <button
                onClick={() => handleQuickRoleSwitch('admin', 'admin@attendly.edu')}
                className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                  currentUser.role === 'admin' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Admin
              </button>
            </div>
          </div>

          <button
            onClick={() => setCurrentUser(null)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white text-xs font-semibold transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h2>
            <p className="text-xs text-slate-500">
              Academic Year 2026–2027 • Department of Computer Science & Engineering (Semester 5)
            </p>
          </div>

          {/* Student Selector when viewing Student Dashboard / Red Line as Teacher or Admin, or demoing multiple students */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-600">Inspect Student:</span>
              <select
                value={activeStudent.student_id}
                onChange={(e) => setSelectedStudentId(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none"
              >
                {enrichedStudents.map((s) => (
                  <option key={s.student_id} value={s.student_id}>
                    {s.full_name} ({s.roll_number}) — {s.overall_percentage}% [{s.status_color}]
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Toast Notification Banner */}
        {toast && (
          <div
            className={`mx-8 mt-4 px-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-between shadow-md ${
              toast.type === 'error'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-900 text-white border-l-4 border-purple-500'
            }`}
          >
            <span>{toast.msg}</span>
            <button onClick={() => setToast(null)} className="text-xs opacity-80 hover:opacity-100">
              Dismiss
            </button>
          </div>
        )}

        <div className="p-8 space-y-8">
          {/* ====================================================================
              MODULE 3: STUDENT ATTENDANCE DASHBOARD
             ==================================================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Top Warning Banner if Student is in RED LINE (<75%) */}
              {activeStudent.is_redline && (
                <div className="bg-rose-50 border-2 border-rose-500 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-600 text-white">
                        RED LINE ALERT ACTIVE (&lt;75%)
                      </span>
                      <h3 className="text-lg font-bold text-rose-950 mt-1">
                        {activeStudent.full_name}&apos;s Overall Attendance is {activeStudent.overall_percentage}%
                      </h3>
                      <p className="text-xs text-rose-800">
                        Minimum required is <strong>75.0%</strong>. Must attend{' '}
                        <strong>{activeStudent.classes_needed_for_75} additional consecutive classes</strong> to recover above the Red Line.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('redline')}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow transition"
                  >
                    Open RED LINE Recovery Center &rarr;
                  </button>
                </div>
              )}

              {/* 4 KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold uppercase text-slate-500">Overall Attendance</p>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-3xl font-extrabold text-slate-900">{activeStudent.overall_percentage}%</span>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        activeStudent.status_color === 'Green'
                          ? 'bg-emerald-100 text-emerald-800'
                          : activeStudent.status_color === 'Yellow'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {activeStudent.status_color === 'Green'
                        ? 'Green: Good (>=80%)'
                        : activeStudent.status_color === 'Yellow'
                        ? 'Yellow: Warning (75-79%)'
                        : 'Red: Low (<75%)'}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full mt-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        activeStudent.status_color === 'Green'
                          ? 'bg-emerald-500'
                          : activeStudent.status_color === 'Yellow'
                          ? 'bg-amber-500'
                          : 'bg-rose-600'
                      }`}
                      style={{ width: `${Math.min(100, activeStudent.overall_percentage)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold uppercase text-slate-500">Total Classes Conducted</p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-2">{activeStudent.total_classes}</p>
                  <p className="text-xs text-slate-500 mt-2">Across 5 Semester-5 Core Subjects</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold uppercase text-slate-500">Total Classes Attended</p>
                  <p className="text-3xl font-extrabold text-emerald-600 mt-2">{activeStudent.attended_classes}</p>
                  <p className="text-xs text-slate-500 mt-2">Verified Faculty Roll-Call Sessions</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-semibold uppercase text-slate-500">Total Classes Missed</p>
                  <p className="text-3xl font-extrabold text-rose-600 mt-2">{activeStudent.missed_classes}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    {activeStudent.classes_needed_for_75 > 0
                      ? `Needs +${activeStudent.classes_needed_for_75} classes for 75%`
                      : 'Meets 75% statutory requirement'}
                  </p>
                </div>
              </div>

              {/* Interactive Charts Row: Subject-Wise BarChart + Monthly Trend AreaChart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900">Subject-Wise Attendance Percentage</h3>
                      <p className="text-xs text-slate-500">Dashed line marks the mandatory 75% RED LINE threshold</p>
                    </div>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activeStudent.subject_breakdown}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="subject_code" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => [`${value}%`, 'Attendance']} />
                        <ReferenceLine y={75} stroke="#e11d48" strokeDasharray="4 4" label={{ value: '75% Red Line', fill: '#e11d48', fontSize: 11 }} />
                        <Bar dataKey="percentage" radius={[8, 8, 0, 0]}>
                          {activeStudent.subject_breakdown.map((entry, idx) => (
                            <Cell
                              key={idx}
                              fill={
                                entry.percentage >= 80
                                  ? '#10b981'
                                  : entry.percentage >= 75
                                  ? '#f59e0b'
                                  : '#e11d48'
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900">Monthly & Semester-Wise Attendance Trend</h3>
                      <p className="text-xs text-slate-500">Tracks monthly attendance trajectory across Semester 5</p>
                    </div>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activeStudent.monthly_reports}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <ReferenceLine y={75} stroke="#e11d48" strokeDasharray="4 4" />
                        <Area
                          type="monotone"
                          dataKey="percentage"
                          name="Monthly Attendance %"
                          stroke="#7c3aed"
                          fill="#ede9fe"
                          strokeWidth={3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Subject-Wise Attendance Cards & Visual Status Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-900">Subject-Wise Attendance Breakdown</h3>
                    <p className="text-xs text-slate-500">
                      Color Indicators: <span className="text-emerald-600 font-semibold">Green (&ge;80% Good)</span> •{' '}
                      <span className="text-amber-600 font-semibold">Yellow (75–79% Warning)</span> •{' '}
                      <span className="text-rose-600 font-semibold">Red (&lt;75% Low / Red Line)</span>
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                        <th className="py-3.5 px-4">Subject</th>
                        <th className="py-3.5 px-4">Faculty & Slot</th>
                        <th className="py-3.5 px-4 text-center">Conducted</th>
                        <th className="py-3.5 px-4 text-center">Attended</th>
                        <th className="py-3.5 px-4 text-center">Missed</th>
                        <th className="py-3.5 px-4">Percentage</th>
                        <th className="py-3.5 px-4">Visual Indicator</th>
                        <th className="py-3.5 px-4">Recovery Needed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {activeStudent.subject_breakdown.map((sub) => (
                        <tr key={sub.subject_id} className="hover:bg-slate-50/80">
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-900">{sub.subject_name}</p>
                            <p className="text-xs text-slate-500 font-mono">{sub.subject_code}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-medium text-slate-800">{sub.teacher_name}</p>
                            <p className="text-xs text-slate-500">{sub.schedule_slot}</p>
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold">{sub.total_classes}</td>
                          <td className="py-3.5 px-4 text-center font-bold text-emerald-600">{sub.attended}</td>
                          <td className="py-3.5 px-4 text-center font-bold text-rose-600">{sub.missed}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{sub.percentage}%</span>
                              <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    sub.status_color === 'Green'
                                      ? 'bg-emerald-500'
                                      : sub.status_color === 'Yellow'
                                      ? 'bg-amber-500'
                                      : 'bg-rose-600'
                                  }`}
                                  style={{ width: `${Math.min(100, sub.percentage)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                sub.status_color === 'Green'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : sub.status_color === 'Yellow'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  sub.status_color === 'Green'
                                    ? 'bg-emerald-600'
                                    : sub.status_color === 'Yellow'
                                    ? 'bg-amber-600'
                                    : 'bg-rose-600'
                                }`}
                              />
                              {sub.status_color === 'Green'
                                ? 'Good'
                                : sub.status_color === 'Yellow'
                                ? 'Warning'
                                : 'Low (Red Line)'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-semibold">
                            {sub.classes_needed_for_75 > 0 ? (
                              <span className="text-rose-600 font-bold">
                                +{sub.classes_needed_for_75} consecutive classes
                              </span>
                            ) : (
                              <span className="text-emerald-600">On Track (&ge;75%)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================================
              MODULE 4: RED LINE – ATTENDANCE WARNING SYSTEM
             ==================================================================== */}
          {activeTab === 'redline' && (
            <div className="space-y-6">
              {/* RED LINE Hero Status Card */}
              <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white p-8 rounded-3xl shadow-xl border border-rose-500/30">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-extrabold uppercase tracking-wider mb-3">
                      <ShieldAlert className="w-4 h-4" />
                      RED LINE Attendance Warning System (75% Statutory Threshold)
                    </div>
                    <h3 className="text-2xl lg:text-3xl font-extrabold">
                      {activeStudent.is_redline
                        ? `WARNING ACTIVE: ${activeStudent.full_name} is at ${activeStudent.overall_percentage}%`
                        : `SAFE STANDING: ${activeStudent.full_name} is at ${activeStudent.overall_percentage}%`}
                    </h3>
                    <p className="text-sm text-rose-200 mt-2">
                      {activeStudent.is_redline
                        ? `Attendance has fallen below the mandatory 75% college limit. Regular automated alerts are active until ${activeStudent.full_name} attends ${activeStudent.classes_needed_for_75} additional consecutive classes.`
                        : `Attendance is above the 75% RED LINE threshold. Automated recovery confirmation has been logged.`}
                    </p>
                  </div>

                  <div className="bg-slate-900/90 border border-rose-400/30 p-6 rounded-2xl text-center min-w-[220px]">
                    <p className="text-xs uppercase font-bold text-rose-300">Additional Classes Needed</p>
                    <p className="text-4xl font-black text-white my-2">
                      +{activeStudent.classes_needed_for_75}
                    </p>
                    <p className="text-xs text-slate-300">Consecutive classes to reach 75.0%</p>
                  </div>
                </div>

                {/* Visual Progress Bar & Risk Indicator */}
                <div className="mt-6 pt-6 border-t border-rose-800/50">
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span>Current Attendance: {activeStudent.overall_percentage}%</span>
                    <span className="text-rose-300">Mandatory RED LINE Target: 75.0%</span>
                    <span className="text-emerald-300">Safe Goal: 80.0%+</span>
                  </div>
                  <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full transition-all duration-500 ${
                        activeStudent.is_redline ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, activeStudent.overall_percentage)}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-white shadow"
                      style={{ left: '75%' }}
                      title="75% RED LINE Threshold"
                    />
                  </div>
                </div>
              </div>

              {/* Interactive Recovery Calculator & All Students Red Line Monitor */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Interactive What-If Recovery Simulator */}
                <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">Interactive 75% Recovery Simulator</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Test how attending upcoming consecutive classes impacts {activeStudent.full_name}&apos;s standing:
                    </p>

                    <div className="mt-6">
                      <label className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                        <span>Simulate Attending Next Consecutive Classes:</span>
                        <span className="text-purple-700 font-extrabold">+{simExtraClasses} Classes</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={simExtraClasses}
                        onChange={(e) => setSimExtraClasses(Number(e.target.value))}
                        className="w-full accent-purple-600"
                      />
                    </div>

                    {(() => {
                      const projAttended = activeStudent.attended_classes + simExtraClasses;
                      const projTotal = activeStudent.total_classes + simExtraClasses;
                      const projPct = projTotal > 0 ? Number(((projAttended / projTotal) * 100).toFixed(2)) : 100;
                      const cleared = projPct >= 75.0;
                      return (
                        <div className={`mt-5 p-4 rounded-2xl border ${cleared ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase text-slate-600">Projected Attendance:</span>
                            <span className={`text-2xl font-black ${cleared ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {projPct}%
                            </span>
                          </div>
                          <p className="text-xs mt-2 font-medium text-slate-700">
                            {cleared
                              ? `Clears the 75% RED LINE! System will automatically trigger a Recovery Notification.`
                              : `Still below 75%. Needs ${calcClassesNeededFor75(projAttended, projTotal)} more consecutive classes.`}
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  <button
                    onClick={() => {
                      const entry = {
                        id: Date.now(),
                        student_id: activeStudent.student_id,
                        student_name: activeStudent.full_name,
                        roll_number: activeStudent.roll_number,
                        notification_type: activeStudent.is_redline ? 'WARNING_BELOW_75' : 'RECOVERY_ABOVE_75',
                        attendance_percentage: activeStudent.overall_percentage,
                        classes_needed: activeStudent.classes_needed_for_75,
                        message: activeStudent.is_redline
                          ? `RED LINE REMINDER: ${activeStudent.full_name} is at ${activeStudent.overall_percentage}%. Must attend +${activeStudent.classes_needed_for_75} consecutive classes to reach 75%.`
                          : `RECOVERY CONFIRMED: ${activeStudent.full_name} is above the 75% limit (${activeStudent.overall_percentage}%).`,
                        created_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
                      };
                      setRedlineLogs((prev) => [entry, ...prev]);
                      showNotification(`Sent RED LINE notification to ${activeStudent.full_name}!`);
                    }}
                    className="mt-6 w-full py-3 rounded-xl bg-slate-900 hover:bg-purple-700 text-white text-xs font-bold transition shadow"
                  >
                    Dispatch Immediate RED LINE Status Alert to {activeStudent.full_name}
                  </button>
                </div>

                {/* All College Students RED LINE Watchlist */}
                <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-900 text-lg mb-1">College-Wide RED LINE Watchlist (&lt;75%)</h4>
                  <p className="text-xs text-slate-500 mb-4">
                    Real-time risk monitor across all enrolled students and their required recovery classes
                  </p>
                  <div className="space-y-3">
                    {enrichedStudents.map((st) => (
                      <div
                        key={st.student_id}
                        className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${
                          st.is_redline ? 'bg-rose-50/70 border-rose-200' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{st.full_name}</span>
                            <span className="text-xs font-mono text-slate-500">({st.roll_number})</span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                st.is_redline
                                  ? 'bg-rose-600 text-white'
                                  : st.status_color === 'Yellow'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {st.is_redline ? 'RED LINE WARNING' : st.status_color === 'Yellow' ? 'BORDERLINE (75-79%)' : 'SAFE (>=80%)'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            Attended {st.attended_classes}/{st.total_classes} classes ({st.overall_percentage}%)
                          </p>
                        </div>
                        <div className="text-right">
                          {st.is_redline ? (
                            <span className="text-xs font-extrabold text-rose-700">
                              Needs +{st.classes_needed_for_75} classes for 75%
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-emerald-700">Above 75% Requirement</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* RED LINE Warning & Recovery Notification Log */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h4 className="font-bold text-slate-900 mb-4">Automated RED LINE Warning & Recovery Notification Feed</h4>
                <div className="space-y-3">
                  {redlineLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                        log.notification_type === 'RECOVERY_ABOVE_75'
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-rose-50 border-rose-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {log.notification_type === 'RECOVERY_ABOVE_75' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {log.student_name} ({log.roll_number}) — {log.attendance_percentage}%
                          </p>
                          <p className="text-xs text-slate-700 mt-0.5">{log.message}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono shrink-0">{log.created_at}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ====================================================================
              MODULE 1: FULL-DAY ATTENDANCE ALERT SYSTEM
             ==================================================================== */}
          {activeTab === 'alerts' && (
            <div className="space-y-6">
              <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                    Module 1 • Anti-Spam Consolidated Parent Notification Engine
                  </span>
                  <h3 className="text-xl font-bold mt-1">Full-Day Attendance Alert System</h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                    Tracks student attendance across all scheduled classes throughout the college day. If a student is absent for the <strong>entire day</strong>, the system dispatches <strong>only ONE consolidated daily email</strong> to their registered parents (suppressing separate per-class emails).
                  </p>
                </div>
                <button
                  onClick={handleRunFullDayAlertScan}
                  className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Run End-of-Day Consolidated Scan ({markSheetDate})</span>
                </button>
              </div>

              {/* Consolidated Notification History Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <h4 className="font-bold text-slate-900">Consolidated Daily Parent Email Notification History</h4>
                  <p className="text-xs text-slate-500">
                    Every email includes Student Name, Date, Department, Academic Year, and Consolidated Attendance Status.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                        <th className="py-3.5 px-4">Student Name</th>
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4">Department & Year</th>
                        <th className="py-3.5 px-4">Registered Parent Email</th>
                        <th className="py-3.5 px-4">Attendance Status</th>
                        <th className="py-3.5 px-4">Delivery Policy</th>
                        <th className="py-3.5 px-4">Inspect Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {dailyAlerts.map((alert) => (
                        <tr key={alert.id} className="hover:bg-slate-50">
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-900">{alert.student_name}</p>
                            <p className="text-xs text-slate-500 font-mono">{alert.roll_number}</p>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold">{alert.absence_date}</td>
                          <td className="py-3.5 px-4 text-xs">
                            <p className="font-semibold text-slate-800">{alert.department_name}</p>
                            <p className="text-slate-500">Year {alert.year}</p>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-mono text-purple-700">{alert.parent_email}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                              {alert.attendance_status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              {alert.delivery_status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => setSelectedEmailPreview(alert)}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-purple-600 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Email</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal to Preview Exact Consolidated Email Sent to Parent */}
              {selectedEmailPreview && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                          Consolidated Daily SMTP Notification Payload
                        </span>
                        <h4 className="font-bold text-slate-900 mt-1">{selectedEmailPreview.email_subject}</h4>
                      </div>
                      <button
                        onClick={() => setSelectedEmailPreview(null)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-4 text-xs space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono whitespace-pre-wrap text-slate-800">
                      {selectedEmailPreview.email_body}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => setSelectedEmailPreview(null)}
                        className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                      >
                        Close Preview
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ====================================================================
              MODULE 2: STUDENT-TEACHER CONNECT (DOUBTS + BIDIRECTIONAL RATINGS)
             ==================================================================== */}
          {activeTab === 'connect' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Ask a Doubt Form */}
                <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-lg">Ask a Subject Doubt</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Send text queries, code snippets, images, or PDF documents directly to your subject professor.
                  </p>
                  <form onSubmit={handlePostDoubt} className="space-y-4 mt-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Select Subject</label>
                      <select
                        value={newDoubt.subject_id}
                        onChange={(e) => setNewDoubt({ ...newDoubt, subject_id: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                      >
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} — {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Doubt Title / Topic</label>
                      <input
                        type="text"
                        required
                        value={newDoubt.title}
                        onChange={(e) => setNewDoubt({ ...newDoubt, title: e.target.value })}
                        placeholder="e.g., Normalization 3NF vs BCNF dependency preservation"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Detailed Question</label>
                      <textarea
                        rows={3}
                        required
                        value={newDoubt.description}
                        onChange={(e) => setNewDoubt({ ...newDoubt, description: e.target.value })}
                        placeholder="Describe your doubt clearly..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Attach Image / Screenshot / PDF Document
                      </label>
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
                        onChange={(e) =>
                          setNewDoubt({
                            ...newDoubt,
                            fileName: e.target.files?.[0]?.name || '',
                          })
                        }
                        className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow transition"
                    >
                      Submit Doubt to Faculty
                    </button>
                  </form>
                </div>

                {/* Right Column: Interactive Doubt Resolution Feed */}
                <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">Subject Doubts & Resolution Thread</h3>
                      <p className="text-xs text-slate-500">Track statuses: Pending, Answered, and Resolved</p>
                    </div>
                    <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                      {['All', 'Pending', 'Answered', 'Resolved'].map((st) => (
                        <button
                          key={st}
                          onClick={() => setDoubtFilter(st)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                            doubtFilter === st ? 'bg-slate-900 text-white' : 'text-slate-600'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {doubts
                      .filter((d) => doubtFilter === 'All' || d.status === doubtFilter)
                      .map((d) => (
                        <div key={d.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 mr-2">
                                {d.subject_code}
                              </span>
                              <span className="text-xs text-slate-500">
                                Asked by <strong>{d.student_name}</strong> ({d.student_roll}) • Assigned to{' '}
                                <strong>{d.teacher_name}</strong>
                              </span>
                              <h4 className="font-bold text-slate-900 mt-1">{d.title}</h4>
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                                d.status === 'Resolved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : d.status === 'Answered'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {d.status}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 leading-relaxed">{d.description}</p>

                          {d.attachment_name && (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-purple-700 font-medium">
                              <FileText className="w-3.5 h-3.5" />
                              <span>Attachment: {d.attachment_name}</span>
                            </div>
                          )}

                          {d.teacher_reply && (
                            <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs space-y-1">
                              <p className="font-bold text-indigo-950">
                                Faculty Response ({d.teacher_name}):
                              </p>
                              <p className="text-indigo-900">{d.teacher_reply}</p>
                            </div>
                          )}

                          {/* Action Controls for Teacher / Student */}
                          <div className="pt-2 flex flex-wrap items-center gap-2">
                            {(currentUser.role === 'teacher' || currentUser.role === 'admin') && d.status !== 'Resolved' && (
                              <div className="flex w-full gap-2">
                                <input
                                  type="text"
                                  value={replyTextMap[d.id] || ''}
                                  onChange={(e) => setReplyTextMap({ ...replyTextMap, [d.id]: e.target.value })}
                                  placeholder="Write faculty response to student..."
                                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                                />
                                <button
                                  onClick={() => handleTeacherReplyDoubt(d.id, 'Answered')}
                                  className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                                >
                                  Reply
                                </button>
                              </div>
                            )}

                            {d.status !== 'Resolved' && (
                              <button
                                onClick={() => handleMarkDoubtResolved(d.id)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                              >
                                Mark as Resolved ✓
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Bidirectional 2-Way Ratings & Feedback Section */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-5 h-5 text-purple-600" />
                    <h3 className="font-bold text-slate-900 text-lg">
                      {currentUser.role === 'student'
                        ? 'Rate Faculty (Student → Teacher)'
                        : 'Evaluate Student (Teacher → Student)'}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    {currentUser.role === 'student'
                      ? 'Rate teachers on Teaching Quality, Doubt-Solving, and Helpfulness.'
                      : 'Provide ratings to students on Participation, Discipline, and Academic Engagement.'}
                  </p>

                  <form onSubmit={handleSubmitRating} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        {currentUser.role === 'student' ? 'Select Faculty Member' : 'Select Student'}
                      </label>
                      <select
                        value={newRating.target_id}
                        onChange={(e) => setNewRating({ ...newRating, target_id: Number(e.target.value) })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                      >
                        {currentUser.role === 'student'
                          ? teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.full_name} ({t.roll_or_emp_id})
                              </option>
                            ))
                          : enrichedStudents.map((s) => (
                              <option key={s.student_id} value={s.student_id}>
                                {s.full_name} ({s.roll_number})
                              </option>
                            ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          {currentUser.role === 'student' ? 'Teaching Quality' : 'Participation'} (1-5)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={newRating.metric_1}
                          onChange={(e) => setNewRating({ ...newRating, metric_1: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          {currentUser.role === 'student' ? 'Doubt-Solving' : 'Discipline'} (1-5)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={newRating.metric_2}
                          onChange={(e) => setNewRating({ ...newRating, metric_2: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          {currentUser.role === 'student' ? 'Helpfulness' : 'Engagement'} (1-5)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={newRating.metric_3}
                          onChange={(e) => setNewRating({ ...newRating, metric_3: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Constructive Feedback</label>
                      <textarea
                        rows={2}
                        value={newRating.comment}
                        onChange={(e) => setNewRating({ ...newRating, comment: e.target.value })}
                        placeholder="Write constructive feedback..."
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-purple-700 text-white text-xs font-bold transition"
                    >
                      Submit Rating & Feedback
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-lg mb-1">Continuous Improvement Ratings & Feedback Wall</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Transparent 2-way academic ratings between students and faculty
                  </p>
                  <div className="space-y-3">
                    {ratings.map((r) => (
                      <div key={r.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                        <div className="flex items-center justify-between">
                          <div>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded mr-2 ${
                                r.direction === 'student_to_teacher'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {r.direction === 'student_to_teacher' ? 'Student → Teacher' : 'Teacher → Student'}
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              {r.from_user_name} &rarr; {r.to_user_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full text-xs font-bold">
                            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            <span>{r.overall_score} / 5.0</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-700 mt-2">{r.comment}</p>
                        <div className="mt-2 flex gap-4 text-[11px] text-slate-500">
                          <span>
                            {r.direction === 'student_to_teacher' ? 'Teaching' : 'Participation'}: <strong>{r.metric_1_score}/5</strong>
                          </span>
                          <span>
                            {r.direction === 'student_to_teacher' ? 'Doubt-Solving' : 'Discipline'}: <strong>{r.metric_2_score}/5</strong>
                          </span>
                          <span>
                            {r.direction === 'student_to_teacher' ? 'Helpfulness' : 'Engagement'}: <strong>{r.metric_3_score}/5</strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================================
              MODULE 5: STUDENT ATTENDANCE ISSUE & LEAVE EXPLANATION
             ==================================================================== */}
          {activeTab === 'leaves' && (
            <div className="space-y-6">
              {/* Important College Policy Callout */}
              <div className="bg-indigo-950 text-white p-5 rounded-2xl border border-indigo-700 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-purple-400 shrink-0" />
                  <div className="text-xs leading-relaxed">
                    <p className="font-bold text-sm text-white">
                      College Attendance Policy Guardrail
                    </p>
                    <p className="text-indigo-200">
                      Submitting an absence explanation records the reason & medical proof for faculty review, but{' '}
                      <strong>does NOT automatically convert an Absent record into Present attendance</strong>. Only authorized faculty/admin can approve attendance condonation according to college policy.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Submit Leave Explanation Form */}
                <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-lg">Submit Absence / Leave Explanation</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Submitting as: <strong>{activeStudent.full_name} ({activeStudent.roll_number})</strong>
                  </p>
                  <form onSubmit={handleSubmitLeaveExplanation} className="space-y-4 mt-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Absence Date</label>
                        <input
                          type="date"
                          required
                          value={newLeave.absence_date}
                          onChange={(e) => setNewLeave({ ...newLeave, absence_date: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Absence Reason</label>
                        <select
                          value={newLeave.reason_category}
                          onChange={(e) => setNewLeave({ ...newLeave, reason_category: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                        >
                          <option value="Medical Emergency">Medical Emergency</option>
                          <option value="Health Issues">Health Issues</option>
                          <option value="Family Emergency">Family Emergency</option>
                          <option value="Personal Reasons">Personal Reasons</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Subject</label>
                      <select
                        value={newLeave.subject_id}
                        onChange={(e) => setNewLeave({ ...newLeave, subject_id: Number(e.target.value) })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                      >
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} — {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Detailed Explanation</label>
                      <textarea
                        rows={3}
                        required
                        value={newLeave.explanation_text}
                        onChange={(e) => setNewLeave({ ...newLeave, explanation_text: e.target.value })}
                        placeholder="Provide complete details regarding your absence..."
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Upload Medical Certificate / Supporting Document
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                        onChange={(e) =>
                          setNewLeave({
                            ...newLeave,
                            document_name: e.target.files?.[0]?.name || '',
                          })
                        }
                        className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow transition"
                    >
                      Submit Explanation for Faculty Review
                    </button>
                  </form>
                </div>

                {/* Submitted Explanations & Faculty Review Queue */}
                <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-lg mb-1">Absence Explanations & Review Status</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Teachers & Administrators can review supporting documents and approve/reject requests
                  </p>

                  <div className="space-y-4">
                    {leaveRequests.map((lv) => (
                      <div key={lv.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-slate-900">
                              {lv.student_name} ({lv.roll_number})
                            </span>
                            <span className="text-xs text-slate-500 ml-2">• Absence Date: {lv.absence_date}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                                {lv.reason_category}
                              </span>
                              <span className="text-xs text-slate-600 font-medium">{lv.subject_name}</span>
                            </div>
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              lv.status === 'Approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : lv.status === 'Rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {lv.status}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700">{lv.explanation_text}</p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span className="inline-flex items-center gap-1.5 text-xs text-purple-700 font-medium">
                            <FileText className="w-3.5 h-3.5" />
                            Proof: {lv.document_name}
                          </span>

                          {(currentUser.role === 'teacher' || currentUser.role === 'admin') && (
                            <button
                              onClick={() => setReviewModal({ ...lv, reviewer_comment: lv.reviewer_comment || '' })}
                              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-purple-600 text-white text-xs font-semibold transition"
                            >
                              Review Request
                            </button>
                          )}
                        </div>

                        {lv.reviewer_comment && (
                          <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs">
                            <p className="font-bold text-slate-800">
                              Reviewed by {lv.reviewer_name || 'Faculty'}:
                            </p>
                            <p className="text-slate-600 mt-0.5">{lv.reviewer_comment}</p>
                            <p className="text-[11px] font-semibold mt-1 text-purple-700">
                              Attendance Record Action:{' '}
                              {lv.convert_to_present
                                ? 'Converted Absent → Present (Authorized Medical Condonation)'
                                : 'Explanation Logged Only (Attendance Unchanged per Policy)'}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Faculty/Admin Leave Review Modal */}
              {reviewModal && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <h4 className="font-bold text-slate-900">
                        Review Absence Explanation — {reviewModal.student_name}
                      </h4>
                      <button onClick={() => setReviewModal(null)} className="p-1 rounded-lg bg-slate-100">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-xs space-y-1 bg-slate-50 p-3.5 rounded-xl">
                      <p><strong>Date:</strong> {reviewModal.absence_date} | <strong>Reason:</strong> {reviewModal.reason_category}</p>
                      <p><strong>Subject:</strong> {reviewModal.subject_name}</p>
                      <p><strong>Explanation:</strong> {reviewModal.explanation_text}</p>
                      <p><strong>Document:</strong> {reviewModal.document_name}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Faculty / Admin Review Remarks</label>
                      <textarea
                        rows={2}
                        value={reviewModal.reviewer_comment}
                        onChange={(e) => setReviewModal({ ...reviewModal, reviewer_comment: e.target.value })}
                        placeholder="Add verification notes..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 pt-2">
                      <button
                        onClick={() => handleFinalizeLeaveReview('Approved', false)}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        Approve Explanation Only (Keep Attendance Record as Absent)
                      </button>
                      <button
                        onClick={() => handleFinalizeLeaveReview('Approved', true)}
                        className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
                      >
                        Approve + Convert Absent to Present (Authorized Policy Condonation)
                      </button>
                      <button
                        onClick={() => handleFinalizeLeaveReview('Rejected', false)}
                        className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                      >
                        Reject Explanation Request
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ====================================================================
              MODULE 6: ADMIN & FACULTY MANAGEMENT DASHBOARD
             ==================================================================== */}
          {activeTab === 'admin' && (
            <div className="space-y-8">
              {/* Top Action Header with Downloadable PDF & Excel Reports */}
              <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                    Module 6 • Role-Based Faculty & Administration Control Center
                  </span>
                  <h3 className="text-xl font-bold mt-1">Admin & Faculty Management Dashboard</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Mark class attendance, manage student/teacher accounts, configure schedules & parent alert emails, and export official reports.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleDownloadReport('excel')}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Excel (CSV) Report</span>
                  </button>
                  <button
                    onClick={() => handleDownloadReport('pdf')}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF Report</span>
                  </button>
                </div>
              </div>

              {/* Faculty Class Attendance Marking Roll-Call Sheet */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">Mark Class Attendance (Faculty Roll-Call)</h4>
                    <p className="text-xs text-slate-500">
                      Updates student attendance percentages in real time and evaluates RED LINE & Full-Day Parent Alerts
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={markSheetSubjectId}
                      onChange={(e) => setMarkSheetSubjectId(Number(e.target.value))}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} — {s.name} ({s.schedule_slot})
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={markSheetDate}
                      onChange={(e) => setMarkSheetDate(e.target.value)}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                    />
                    <button
                      onClick={handleMarkClassAttendanceSubmit}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-purple-700 text-white text-xs font-bold shadow transition"
                    >
                      Save Class Attendance
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-xs uppercase border-b border-slate-200">
                        <th className="py-3 px-4">Roll No</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Current Cumulative %</th>
                        <th className="py-3 px-4">Parent Email & Alert Toggle</th>
                        <th className="py-3 px-4 text-right">Mark Attendance Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {enrichedStudents.map((st) => {
                        const statusVal = markSheetStatus[st.student_id] || 'Present';
                        return (
                          <tr key={st.student_id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono text-xs font-bold">{st.roll_number}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">{st.full_name}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  st.is_redline ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {st.overall_percentage}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-slate-600">{st.parent_email}</span>
                                <input
                                  type="checkbox"
                                  checked={st.notify_parent_email}
                                  onChange={(e) =>
                                    setStudents((prev) =>
                                      prev.map((item) =>
                                        item.student_id === st.student_id
                                          ? { ...item, notify_parent_email: e.target.checked }
                                          : item
                                      )
                                    )
                                  }
                                  title="Toggle Consolidated Parent Email Alert"
                                  className="accent-purple-600"
                                />
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                                <button
                                  type="button"
                                  onClick={() => setMarkSheetStatus({ ...markSheetStatus, [st.student_id]: 'Present' })}
                                  className={`px-3.5 py-1 rounded-lg text-xs font-bold transition ${
                                    statusVal === 'Present' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600'
                                  }`}
                                >
                                  Present
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMarkSheetStatus({ ...markSheetStatus, [st.student_id]: 'Absent' })}
                                  className={`px-3.5 py-1 rounded-lg text-xs font-bold transition ${
                                    statusVal === 'Absent' ? 'bg-rose-600 text-white shadow' : 'text-slate-600'
                                  }`}
                                >
                                  Absent
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Manage Students, Faculty & Class Schedules */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Add Student or Teacher Account */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="font-bold text-slate-900 text-lg">Add Student / Faculty Account</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={newUserForm.full_name}
                      onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Roll No / Employee ID"
                      value={newUserForm.roll_or_emp_id}
                      onChange={(e) => setNewUserForm({ ...newUserForm, roll_or_emp_id: e.target.value })}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                    <select
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                    </select>
                  </div>
                  {newUserForm.role === 'student' && (
                    <input
                      type="email"
                      placeholder="Parent Email Address (for Consolidated Daily Alerts)"
                      value={newUserForm.parent_email}
                      onChange={(e) => setNewUserForm({ ...newUserForm, parent_email: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  )}
                  <button
                    onClick={() => {
                      if (!newUserForm.full_name || !newUserForm.email || !newUserForm.roll_or_emp_id) {
                        showNotification('Please fill in Name, Email, and ID', 'error');
                        return;
                      }
                      if (newUserForm.role === 'student') {
                        const newId = Date.now();
                        setStudents((prev) => [
                          ...prev,
                          {
                            student_id: newId,
                            full_name: newUserForm.full_name,
                            roll_number: newUserForm.roll_or_emp_id,
                            email: newUserForm.email,
                            department_id: 1,
                            department_name: 'Computer Science & Engineering',
                            department_code: 'CSE',
                            year: 3,
                            semester: 5,
                            parent_name: 'Registered Parent',
                            parent_email: newUserForm.parent_email || 'parent@college.edu',
                            notify_parent_email: true,
                            notify_redline_alerts: true,
                            subject_stats: subjects.map((s) => ({ subject_id: s.id, attended: 16, total: 20 })),
                            monthly_reports: [
                              { month: 'Sep 2026', conducted: 35, attended: 28, missed: 7, percentage: 80.0 },
                              { month: 'Oct 2026', conducted: 35, attended: 28, missed: 7, percentage: 80.0 },
                              { month: 'Nov 2026', conducted: 30, attended: 24, missed: 6, percentage: 80.0 },
                            ],
                          },
                        ]);
                      } else {
                        setTeachers((prev) => [
                          ...prev,
                          {
                            id: Date.now(),
                            full_name: newUserForm.full_name,
                            email: newUserForm.email,
                            roll_or_emp_id: newUserForm.roll_or_emp_id,
                            department_id: 1,
                          },
                        ]);
                      }
                      setNewUserForm({ full_name: '', email: '', roll_or_emp_id: '', role: 'student', parent_email: '' });
                      showNotification(`Added ${newUserForm.role} account successfully!`);
                    }}
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
                  >
                    + Create Account
                  </button>

                  {/* Quick Directory List with Remove Action */}
                  <div className="pt-3 border-t border-slate-200 space-y-2 max-h-48 overflow-y-auto">
                    {enrichedStudents.map((st) => (
                      <div key={st.student_id} className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-lg">
                        <span>
                          <strong>{st.full_name}</strong> ({st.roll_number}) — Parent: {st.parent_email}
                        </span>
                        <button
                          onClick={() => {
                            if (students.length <= 1) return;
                            setStudents((prev) => prev.filter((item) => item.student_id !== st.student_id));
                            showNotification(`Removed student ${st.full_name}`);
                          }}
                          className="text-rose-600 hover:text-rose-800 font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add Subject & Schedule Manager */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="font-bold text-slate-900 text-lg">Manage Subjects & Class Schedules</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Subject Name (e.g., Compiler Design)"
                      value={newSubjectForm.name}
                      onChange={(e) => setNewSubjectForm({ ...newSubjectForm, name: e.target.value })}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Subject Code (e.g., CS506)"
                      value={newSubjectForm.code}
                      onChange={(e) => setNewSubjectForm({ ...newSubjectForm, code: e.target.value })}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                    <select
                      value={newSubjectForm.teacher_id}
                      onChange={(e) => setNewSubjectForm({ ...newSubjectForm, teacher_id: Number(e.target.value) })}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                    >
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Schedule Slot (e.g., 03:45 PM - 04:45 PM)"
                      value={newSubjectForm.schedule_slot}
                      onChange={(e) => setNewSubjectForm({ ...newSubjectForm, schedule_slot: e.target.value })}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!newSubjectForm.name || !newSubjectForm.code) {
                        showNotification('Please enter Subject Name and Code', 'error');
                        return;
                      }
                      const newSubId = Date.now();
                      setSubjects((prev) => [
                        ...prev,
                        {
                          id: newSubId,
                          name: newSubjectForm.name,
                          code: newSubjectForm.code,
                          department_id: 1,
                          semester: 5,
                          teacher_id: Number(newSubjectForm.teacher_id),
                          schedule_slot: newSubjectForm.schedule_slot,
                        },
                      ]);
                      setStudents((prev) =>
                        prev.map((s) => ({
                          ...s,
                          subject_stats: [...s.subject_stats, { subject_id: newSubId, attended: 16, total: 20 }],
                        }))
                      );
                      setNewSubjectForm({ name: '', code: '', semester: 5, teacher_id: 2, schedule_slot: '03:45 PM - 04:45 PM' });
                      showNotification('Added new subject and linked class schedule!');
                    }}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-purple-700 text-white text-xs font-bold"
                  >
                    + Add Subject & Schedule
                  </button>

                  <div className="pt-3 border-t border-slate-200 space-y-2 max-h-48 overflow-y-auto">
                    {subjects.map((sub) => {
                      const t = teachers.find((tc) => tc.id === sub.teacher_id);
                      return (
                        <div key={sub.id} className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-lg">
                          <span>
                            <strong>{sub.code}</strong>: {sub.name} ({sub.schedule_slot}) — {t?.full_name || 'Faculty'}
                          </span>
                          <span className="text-[11px] font-semibold text-purple-700">Sem {sub.semester}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
