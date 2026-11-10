import os
import io
import csv
import math
import uuid
import smtplib
import hashlib
from datetime import datetime, date, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import (
    create_engine, Column, Integer, String, Boolean, Date, DateTime,
    ForeignKey, Text, Float, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from jose import jwt, JWTError
from dotenv import load_dotenv

load_dotenv()

# ============================================================================
# 1. CONFIGURATION & DATABASE SETUP (PostgreSQL / MySQL / SQLite Fallback)
# ============================================================================
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./attendly.db")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "attendly-super-secret-jwt-key-2026")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "ATTENDLY Alert System <alerts@attendly.edu>")
SMTP_ENABLED = os.getenv("SMTP_ENABLED", "false").lower() == "true"

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ============================================================================
# 2. DATABASE MODELS
# ============================================================================
class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    hod_name = Column(String(120), nullable=True)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)  # 'student', 'teacher', 'admin'
    roll_or_emp_id = Column(String(50), unique=True, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    year = Column(Integer, default=3)
    semester = Column(Integer, default=5)
    parent_name = Column(String(120), nullable=True)
    parent_email = Column(String(150), nullable=True)
    parent_phone = Column(String(30), nullable=True)
    notify_parent_email = Column(Boolean, default=True)
    notify_redline_alerts = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    code = Column(String(30), unique=True, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    semester = Column(Integer, nullable=False, default=5)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    schedule_slot = Column(String(120), nullable=False)


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    attendance_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False)  # 'Present' or 'Absent'
    marked_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    remarks = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("student_id", "subject_id", "attendance_date", name="uq_student_subject_date"),)


class DailyAbsenceNotification(Base):
    __tablename__ = "daily_absence_notifications"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    absence_date = Column(Date, nullable=False)
    parent_email = Column(String(150), nullable=False)
    total_classes_scheduled = Column(Integer, nullable=False)
    total_classes_absent = Column(Integer, nullable=False)
    email_subject = Column(String(255), nullable=False)
    email_body = Column(Text, nullable=False)
    delivery_status = Column(String(30), default="Sent (Consolidated)")
    sent_at = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("student_id", "absence_date", name="uq_consolidated_daily_alert"),)


class RedlineNotification(Base):
    __tablename__ = "redline_notifications"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    notification_type = Column(String(30), nullable=False)  # 'WARNING_BELOW_75' or 'RECOVERY_ABOVE_75'
    attendance_percentage = Column(Float, nullable=False)
    classes_needed = Column(Integer, nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Doubt(Base):
    __tablename__ = "doubts"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    attachment_name = Column(String(255), nullable=True)
    attachment_url = Column(String(500), nullable=True)
    status = Column(String(20), default="Pending")  # 'Pending', 'Answered', 'Resolved'
    teacher_reply = Column(Text, nullable=True)
    replied_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class RatingFeedback(Base):
    __tablename__ = "ratings_feedback"
    id = Column(Integer, primary_key=True, index=True)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    direction = Column(String(30), nullable=False)  # 'student_to_teacher' or 'teacher_to_student'
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    metric_1_score = Column(Integer, nullable=False)  # Teaching Quality / Participation
    metric_2_score = Column(Integer, nullable=False)  # Doubt Solving / Discipline
    metric_3_score = Column(Integer, nullable=False)  # Helpfulness / Academic Engagement
    overall_score = Column(Float, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class LeaveExplanation(Base):
    __tablename__ = "leave_explanations"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    absence_date = Column(Date, nullable=False)
    reason_category = Column(String(50), nullable=False)
    explanation_text = Column(Text, nullable=False)
    document_name = Column(String(255), nullable=True)
    document_url = Column(String(500), nullable=True)
    status = Column(String(20), default="Pending")  # 'Pending', 'Approved', 'Rejected'
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewer_comment = Column(Text, nullable=True)
    convert_to_present = Column(Boolean, default=False)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================================
# 3. UTILITY FUNCTIONS (AUTH, ATTENDANCE MATH, EMAIL DISPATCH)
# ============================================================================
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    return hash_password(plain) == hashed


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=24)
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def calculate_classes_needed_for_75(attended: int, total: int) -> int:
    """
    Calculates how many consecutive classes a student must attend to reach >= 75%:
    (attended + x) / (total + x) >= 0.75
    attended + x >= 0.75 * total + 0.75 * x
    0.25 * x >= 0.75 * total - attended
    x >= 3 * total - 4 * attended
    """
    if total == 0:
        return 0
    needed = 3 * total - 4 * attended
    return max(0, needed)


def get_attendance_status_badge(percentage: float) -> str:
    if percentage >= 80.0:
        return "Green"
    elif percentage >= 75.0:
        return "Yellow"
    return "Red"


def send_smtp_email(to_email: str, subject: str, body: str) -> str:
    if not SMTP_ENABLED or not SMTP_USER or not SMTP_PASSWORD:
        return "Simulated (SMTP Ready)"
    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_FROM_EMAIL
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return "Sent via SMTP"
    except Exception as exc:
        return f"Logged ({str(exc)[:40]})"


def evaluate_full_day_absence_alert(db: Session, student_id: int, target_date: date) -> Optional[DailyAbsenceNotification]:
    """
    Module 1: Full-Day Attendance Alert System
    - Checks all classes recorded for the student on `target_date`.
    - Only triggers when the student has >= 3 classes recorded for the day AND is Absent in ALL of them.
    - Never sends separate emails per class; generates strictly ONE consolidated daily email per student/date.
    """
    existing = db.query(DailyAbsenceNotification).filter_by(
        student_id=student_id, absence_date=target_date
    ).first()
    if existing:
        return existing

    student = db.query(User).filter_by(id=student_id, role="student").first()
    if not student or not student.notify_parent_email or not student.parent_email:
        return None

    day_records = db.query(AttendanceRecord).filter_by(
        student_id=student_id, attendance_date=target_date
    ).all()

    if len(day_records) < 3:
        return None

    absent_count = sum(1 for r in day_records if r.status == "Absent")
    if absent_count < len(day_records):
        return None  # Student attended at least one class today

    dept = db.query(Department).filter_by(id=student.department_id).first()
    dept_name = dept.name if dept else "Engineering"

    email_subject = f"[ATTENDLY Consolidated Daily Alert] Full-Day Absence Notice - {student.full_name} ({target_date.isoformat()})"
    email_body = (
        f"Dear {student.parent_name or 'Parent/Guardian'},\n\n"
        f"This is an automated consolidated end-of-day attendance notification from ATTENDLY College Management System.\n\n"
        f"Student Name      : {student.full_name} ({student.roll_or_emp_id})\n"
        f"Date              : {target_date.strftime('%B %d, %Y')}\n"
        f"Department        : {dept_name}\n"
        f"Academic Year     : Year {student.year} (Semester {student.semester})\n"
        f"Attendance Status : FULL-DAY ABSENT ({absent_count}/{len(day_records)} classes missed)\n\n"
        f"If this absence was due to medical or family reasons, please ask the student to submit an Absence Explanation "
        f"with supporting documentation through the ATTENDLY Student Portal.\n\n"
        f"Regards,\n"
        f"ATTENDLY Academic Monitoring Cell"
    )

    delivery = send_smtp_email(student.parent_email, email_subject, email_body)
    alert = DailyAbsenceNotification(
        student_id=student.id,
        absence_date=target_date,
        parent_email=student.parent_email,
        total_classes_scheduled=len(day_records),
        total_classes_absent=absent_count,
        email_subject=email_subject,
        email_body=email_body,
        delivery_status=delivery,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def evaluate_redline_status_change(db: Session, student_id: int, previous_pct: Optional[float] = None):
    """
    Module 4: RED LINE Warning System
    - Automatically activates warning when attendance < 75%.
    - Automatically notifies student when attendance recovers to >= 75%.
    """
    records = db.query(AttendanceRecord).filter_by(student_id=student_id).all()
    if not records:
        return None
    total = len(records)
    attended = sum(1 for r in records if r.status == "Present")
    current_pct = round((attended / total) * 100, 2)
    needed = calculate_classes_needed_for_75(attended, total)

    if current_pct < 75.0:
        msg = (
            f"RED LINE WARNING: Your overall attendance is at {current_pct}% (below the mandatory 75% threshold). "
            f"You must attend {needed} consecutive upcoming classes to restore your eligibility."
        )
        notif = RedlineNotification(
            student_id=student_id,
            notification_type="WARNING_BELOW_75",
            attendance_percentage=current_pct,
            classes_needed=needed,
            message=msg,
        )
        db.add(notif)
        db.commit()
        return notif
    elif previous_pct is not None and previous_pct < 75.0 and current_pct >= 75.0:
        msg = (
            f"CONGRATULATIONS! Your attendance has recovered to {current_pct}%, clearing the 75% RED LINE threshold. "
            f"Keep maintaining regular attendance!"
        )
        notif = RedlineNotification(
            student_id=student_id,
            notification_type="RECOVERY_ABOVE_75",
            attendance_percentage=current_pct,
            classes_needed=0,
            message=msg,
        )
        db.add(notif)
        db.commit()
        return notif
    return None


def get_student_attendance_summary(db: Session, student: User) -> dict:
    dept = db.query(Department).filter_by(id=student.department_id).first()
    subjects = db.query(Subject).filter_by(department_id=student.department_id).all()
    all_records = db.query(AttendanceRecord).filter_by(student_id=student.id).order_by(AttendanceRecord.attendance_date.asc()).all()

    total_classes = len(all_records)
    total_attended = sum(1 for r in all_records if r.status == "Present")
    total_missed = total_classes - total_attended
    overall_pct = round((total_attended / total_classes) * 100, 2) if total_classes > 0 else 100.0
    classes_needed = calculate_classes_needed_for_75(total_attended, total_classes)

    subject_breakdown = []
    for subj in subjects:
        s_records = [r for r in all_records if r.subject_id == subj.id]
        s_total = len(s_records)
        s_attended = sum(1 for r in s_records if r.status == "Present")
        s_missed = s_total - s_attended
        s_pct = round((s_attended / s_total) * 100, 2) if s_total > 0 else 100.0
        s_needed = calculate_classes_needed_for_75(s_attended, s_total)
        teacher = db.query(User).filter_by(id=subj.teacher_id).first()
        subject_breakdown.append({
            "subject_id": subj.id,
            "subject_name": subj.name,
            "subject_code": subj.code,
            "schedule_slot": subj.schedule_slot,
            "teacher_name": teacher.full_name if teacher else "Faculty",
            "total_classes": s_total,
            "attended": s_attended,
            "missed": s_missed,
            "percentage": s_pct,
            "status_color": get_attendance_status_badge(s_pct),
            "classes_needed_for_75": s_needed,
        })

    # Monthly trend calculation
    monthly_map = {}
    for r in all_records:
        m_key = r.attendance_date.strftime("%b %Y")
        if m_key not in monthly_map:
            monthly_map[m_key] = {"month": m_key, "conducted": 0, "attended": 0, "missed": 0}
        monthly_map[m_key]["conducted"] += 1
        if r.status == "Present":
            monthly_map[m_key]["attended"] += 1
        else:
            monthly_map[m_key]["missed"] += 1

    monthly_reports = []
    for m_key, m_val in monthly_map.items():
        pct = round((m_val["attended"] / m_val["conducted"]) * 100, 1) if m_val["conducted"] > 0 else 0.0
        monthly_reports.append({**m_val, "percentage": pct})

    return {
        "student_id": student.id,
        "full_name": student.full_name,
        "roll_number": student.roll_or_emp_id,
        "email": student.email,
        "department_id": student.department_id,
        "department_name": dept.name if dept else "Computer Science & Engineering",
        "department_code": dept.code if dept else "CSE",
        "year": student.year,
        "semester": student.semester,
        "parent_name": student.parent_name,
        "parent_email": student.parent_email,
        "parent_phone": student.parent_phone,
        "notify_parent_email": student.notify_parent_email,
        "notify_redline_alerts": student.notify_redline_alerts,
        "total_classes": total_classes,
        "attended_classes": total_attended,
        "missed_classes": total_missed,
        "overall_percentage": overall_pct,
        "status_color": get_attendance_status_badge(overall_pct),
        "is_redline": overall_pct < 75.0,
        "classes_needed_for_75": classes_needed,
        "subject_breakdown": subject_breakdown,
        "monthly_reports": monthly_reports,
    }


# ============================================================================
# 4. REALISTIC SEED DATA INITIALIZATION
# ============================================================================
def seed_initial_data(db: Session):
    if db.query(User).count() > 0:
        return

    # 1. Departments
    cse = Department(name="Computer Science & Engineering", code="CSE", hod_name="Dr. Vikramaditya Rao")
    ece = Department(name="Electronics & Communication", code="ECE", hod_name="Dr. Meenakshi Iyer")
    aiml = Department(name="Artificial Intelligence & Data Science", code="AI&DS", hod_name="Dr. Siddharth Menon")
    db.add_all([cse, ece, aiml])
    db.commit()
    db.refresh(cse)
    db.refresh(ece)
    db.refresh(aiml)

    # 2. Admin & Teachers
    admin_user = User(
        full_name="Dr. Rajeshwari Kulkarni (Dean Academics)",
        email="admin@attendly.edu",
        password_hash=hash_password("admin123"),
        role="admin",
        roll_or_emp_id="ADM-001",
        department_id=cse.id,
    )
    t1 = User(
        full_name="Prof. Ananya Deshmukh",
        email="ananya@attendly.edu",
        password_hash=hash_password("teacher123"),
        role="teacher",
        roll_or_emp_id="FAC-CSE-101",
        department_id=cse.id,
    )
    t2 = User(
        full_name="Dr. Karthik Subramanian",
        email="karthik@attendly.edu",
        password_hash=hash_password("teacher123"),
        role="teacher",
        roll_or_emp_id="FAC-CSE-102",
        department_id=cse.id,
    )
    t3 = User(
        full_name="Prof. Rohan Chatterjee",
        email="rohan@attendly.edu",
        password_hash=hash_password("teacher123"),
        role="teacher",
        roll_or_emp_id="FAC-CSE-103",
        department_id=cse.id,
    )
    db.add_all([admin_user, t1, t2, t3])
    db.commit()
    for u in [admin_user, t1, t2, t3]:
        db.refresh(u)

    # 3. Realistic Students (covering Red Line <75%, Yellow Warning 75-79%, and Green >=80%)
    students_spec = [
        {
            "full_name": "Aarav Sharma",
            "email": "aarav@attendly.edu",
            "roll": "21CSE042",
            "parent_name": "Suresh Sharma",
            "parent_email": "suresh.sharma@parentmail.com",
            "parent_phone": "+91 98450 11223",
            "target_ratio": 0.68,  # RED LINE (<75%) - Great default demo student!
        },
        {
            "full_name": "Priya Nair",
            "email": "priya@attendly.edu",
            "roll": "21CSE018",
            "parent_name": "Venugopal Nair",
            "parent_email": "venugopal.nair@parentmail.com",
            "parent_phone": "+91 98450 22334",
            "target_ratio": 0.92,  # GREEN (Good attendance)
        },
        {
            "full_name": "Rohan Verma",
            "email": "rohan.v@attendly.edu",
            "roll": "21CSE055",
            "parent_name": "Mahesh Verma",
            "parent_email": "mahesh.verma@parentmail.com",
            "parent_phone": "+91 98450 33445",
            "target_ratio": 0.76,  # YELLOW Warning (75% - 79%)
        },
        {
            "full_name": "Sneha Patel",
            "email": "sneha@attendly.edu",
            "roll": "21CSE063",
            "parent_name": "Kishore Patel",
            "parent_email": "kishore.patel@parentmail.com",
            "parent_phone": "+91 98450 44556",
            "target_ratio": 0.64,  # RED LINE (<75%)
        },
        {
            "full_name": "Aditya Menon",
            "email": "aditya@attendly.edu",
            "roll": "21CSE009",
            "parent_name": "Prakash Menon",
            "parent_email": "prakash.menon@parentmail.com",
            "parent_phone": "+91 98450 55667",
            "target_ratio": 0.88,  # GREEN
        },
        {
            "full_name": "Kavya Krishnan",
            "email": "kavya@attendly.edu",
            "roll": "21CSE029",
            "parent_name": "Ramesh Krishnan",
            "parent_email": "ramesh.krishnan@parentmail.com",
            "parent_phone": "+91 98450 66778",
            "target_ratio": 0.71,  # RED LINE (<75%)
        },
    ]

    student_objs = []
    for sp in students_spec:
        s = User(
            full_name=sp["full_name"],
            email=sp["email"],
            password_hash=hash_password("student123"),
            role="student",
            roll_or_emp_id=sp["roll"],
            department_id=cse.id,
            year=3,
            semester=5,
            parent_name=sp["parent_name"],
            parent_email=sp["parent_email"],
            parent_phone=sp["parent_phone"],
            notify_parent_email=True,
            notify_redline_alerts=True,
        )
        db.add(s)
        student_objs.append((s, sp["target_ratio"]))
    db.commit()
    for s, _ in student_objs:
        db.refresh(s)

    # 4. Subjects
    subjects_data = [
        Subject(name="Database Management Systems", code="CS501", department_id=cse.id, semester=5, teacher_id=t1.id, schedule_slot="09:00 AM - 10:00 AM"),
        Subject(name="Operating Systems & Internals", code="CS502", department_id=cse.id, semester=5, teacher_id=t2.id, schedule_slot="10:15 AM - 11:15 AM"),
        Subject(name="Computer Networks & Security", code="CS503", department_id=cse.id, semester=5, teacher_id=t3.id, schedule_slot="11:30 AM - 12:30 PM"),
        Subject(name="Machine Learning Foundations", code="CS504", department_id=cse.id, semester=5, teacher_id=t1.id, schedule_slot="01:30 PM - 02:30 PM"),
        Subject(name="Software Engineering & Cloud", code="CS505", department_id=cse.id, semester=5, teacher_id=t2.id, schedule_slot="02:45 PM - 03:45 PM"),
    ]
    db.add_all(subjects_data)
    db.commit()
    for subj in subjects_data:
        db.refresh(subj)

    # 5. Generate 20 working days of realistic attendance across 3 months (Sep, Oct, Nov 2026)
    sample_dates = [
        date(2026, 9, 7), date(2026, 9, 9), date(2026, 9, 11), date(2026, 9, 14), date(2026, 9, 16), date(2026, 9, 18), date(2026, 9, 22),
        date(2026, 10, 5), date(2026, 10, 7), date(2026, 10, 9), date(2026, 10, 12), date(2026, 10, 14), date(2026, 10, 16), date(2026, 10, 20),
        date(2026, 11, 2), date(2026, 11, 3), date(2026, 11, 4), date(2026, 11, 5), date(2026, 11, 6), date(2026, 11, 9)
    ]

    for s_idx, (student, ratio) in enumerate(student_objs):
        total_slots = len(sample_dates) * len(subjects_data)  # 100 classes
        target_presents = int(round(total_slots * ratio))
        slot_counter = 0

        # Ensure full-day absence on specific dates for RED LINE students so Consolidated Parent Email Alerts trigger realistically
        full_day_absent_dates = set()
        if ratio < 0.75:
            full_day_absent_dates.add(date(2026, 11, 5))
            full_day_absent_dates.add(date(2026, 11, 9))

        for d_idx, att_date in enumerate(sample_dates):
            for subj_idx, subj in enumerate(subjects_data):
                slot_counter += 1
                if att_date in full_day_absent_dates:
                    status_val = "Absent"
                else:
                    # Deterministic distribution matching target ratio
                    threshold = int(round(ratio * 10))
                    is_present = ((d_idx * 3 + subj_idx + s_idx) % 10) < threshold
                    status_val = "Present" if is_present else "Absent"

                rec = AttendanceRecord(
                    student_id=student.id,
                    subject_id=subj.id,
                    attendance_date=att_date,
                    status=status_val,
                    marked_by=subj.teacher_id,
                    remarks="Regular session",
                )
                db.add(rec)
        db.commit()

        # Trigger consolidated full-day parent alerts for full-day absences
        for fd_date in sorted(list(full_day_absent_dates)):
            evaluate_full_day_absence_alert(db, student.id, fd_date)

        # Evaluate Red Line status notifications
        evaluate_redline_status_change(db, student.id, previous_pct=78.0)

    aarav = student_objs[0][0]
    priya = student_objs[1][0]
    sneha = student_objs[3][0]

    # 6. Seed Student-Teacher Connect Doubts
    d1 = Doubt(
        student_id=aarav.id,
        subject_id=subjects_data[0].id,
        teacher_id=t1.id,
        title="B+ Tree Indexing vs Hash Indexing in PostgreSQL",
        description="Ma'am, in Lecture 14 we discussed range queries on composite keys. Why does PostgreSQL default to B-Tree instead of Hash index for equality + range predicates? I have attached my schema benchmark screenshot.",
        attachment_name="btree_vs_hash_benchmark.pdf",
        attachment_url="/uploads/sample_btree_benchmark.pdf",
        status="Answered",
        teacher_reply="Great question, Aarav! B-Tree stores keys in sorted order, allowing O(log N) traversal for both equality and range queries (<, >, BETWEEN), whereas Hash indexes only support exact equality (=) lookups. Let's review your query plan in tomorrow's lab.",
        replied_at=datetime.utcnow() - timedelta(hours=5),
    )
    d2 = Doubt(
        student_id=priya.id,
        subject_id=subjects_data[1].id,
        teacher_id=t2.id,
        title="Deadlock Avoidance: Banker's Algorithm Safe Sequence",
        description="Sir, when multiple processes request resources simultaneously, how do we handle safe state verification if the Available vector changes mid-cycle?",
        attachment_name="bankers_matrix_work.png",
        attachment_url="/uploads/sample_bankers_matrix.png",
        status="Resolved",
        teacher_reply="Priya, each resource request is evaluated atomically using the Safety Algorithm before allocation is committed. Once verified, you mark the process in the safe sequence.",
        replied_at=datetime.utcnow() - timedelta(days=1),
    )
    d3 = Doubt(
        student_id=sneha.id,
        subject_id=subjects_data[3].id,
        teacher_id=t1.id,
        title="Overfitting in Random Forest vs Gradient Boosted Trees",
        description="Ma'am, my validation loss starts increasing after 150 estimators in Gradient Boosting, whereas Random Forest stays stable. Should I reduce learning_rate or max_depth first?",
        attachment_name="validation_curve_plot.png",
        attachment_url="/uploads/sample_validation_curve.png",
        status="Pending",
    )
    db.add_all([d1, d2, d3])
    db.commit()

    # 7. Seed Bidirectional Ratings & Feedback (Student <-> Teacher)
    r1 = RatingFeedback(
        from_user_id=aarav.id,
        to_user_id=t1.id,
        direction="student_to_teacher",
        subject_id=subjects_data[0].id,
        metric_1_score=5,  # Teaching Quality
        metric_2_score=5,  # Doubt Solving
        metric_3_score=5,  # Helpfulness
        overall_score=5.0,
        comment="Prof. Ananya explains complex DBMS indexing and normalization concepts with real production database examples!",
    )
    r2 = RatingFeedback(
        from_user_id=priya.id,
        to_user_id=t2.id,
        direction="student_to_teacher",
        subject_id=subjects_data[1].id,
        metric_1_score=5,
        metric_2_score=4,
        metric_3_score=5,
        overall_score=4.67,
        comment="Very clear OS kernel walkthroughs and fast responses on Student-Teacher Connect.",
    )
    r3 = RatingFeedback(
        from_user_id=t1.id,
        to_user_id=aarav.id,
        direction="teacher_to_student",
        subject_id=subjects_data[0].id,
        metric_1_score=4,  # Participation
        metric_2_score=4,  # Discipline
        metric_3_score=5,  # Academic Engagement
        overall_score=4.33,
        comment="Aarav asks insightful technical questions in DBMS labs, though he needs to improve his morning lecture attendance to clear the 75% Red Line.",
    )
    r4 = RatingFeedback(
        from_user_id=t2.id,
        to_user_id=priya.id,
        direction="teacher_to_student",
        subject_id=subjects_data[1].id,
        metric_1_score=5,
        metric_2_score=5,
        metric_3_score=5,
        overall_score=5.0,
        comment="Outstanding lab participation, consistent 90%+ attendance, and strong peer mentoring.",
    )
    db.add_all([r1, r2, r3, r4])
    db.commit()

    # 8. Seed Student Attendance Issue & Leave Explanations
    l1 = LeaveExplanation(
        student_id=aarav.id,
        subject_id=subjects_data[0].id,
        absence_date=date(2026, 11, 9),
        reason_category="Medical Emergency",
        explanation_text="Had acute viral fever and visited Apollo Clinic for blood work and physician consultation. Medical certificate attached for verification.",
        document_name="apollo_medical_certificate_nov9.pdf",
        document_url="/uploads/apollo_medical_certificate_nov9.pdf",
        status="Pending",
        convert_to_present=False,
    )
    l2 = LeaveExplanation(
        student_id=sneha.id,
        subject_id=subjects_data[2].id,
        absence_date=date(2026, 11, 5),
        reason_category="Family Emergency",
        explanation_text="Had to travel out of station with family due to an urgent family medical situation.",
        document_name="parent_signed_letter.pdf",
        document_url="/uploads/parent_signed_letter.pdf",
        status="Approved",
        reviewer_id=t1.id,
        reviewer_comment="Verified parent letter. Explanation recorded on file; per college policy, attendance remains unchanged unless medical condonation is granted by Dean.",
        convert_to_present=False,
        reviewed_at=datetime.utcnow() - timedelta(days=1),
    )
    db.add_all([l1, l2])
    db.commit()


# ============================================================================
# 5. FASTAPI APPLICATION & PYDANTIC SCHEMAS
# ============================================================================
app = FastAPI(
    title="ATTENDLY – Smart Student Attendance & Management System API",
    version="2.0.0",
    description="Full-stack API for College Attendance, Full-Day Parent Alerts, RED LINE Warning System, Student-Teacher Connect, and Admin Management.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str = "student"
    roll_or_emp_id: str
    department_id: int = 1
    year: int = 3
    semester: int = 5
    parent_name: Optional[str] = None
    parent_email: Optional[str] = None
    parent_phone: Optional[str] = None


class MarkAttendanceItem(BaseModel):
    student_id: int
    status: str  # 'Present' or 'Absent'
    remarks: Optional[str] = ""


class MarkAttendanceBatchRequest(BaseModel):
    subject_id: int
    attendance_date: date
    teacher_id: int
    records: List[MarkAttendanceItem]
    trigger_full_day_check: bool = True


class DoubtReplyRequest(BaseModel):
    teacher_reply: str
    status: str = "Answered"


class RatingCreateRequest(BaseModel):
    from_user_id: int
    to_user_id: int
    direction: str  # 'student_to_teacher' or 'teacher_to_student'
    subject_id: Optional[int] = None
    metric_1_score: int
    metric_2_score: int
    metric_3_score: int
    comment: Optional[str] = ""


class LeaveReviewRequest(BaseModel):
    reviewer_id: int
    status: str  # 'Approved' or 'Rejected'
    reviewer_comment: str
    convert_to_present: bool = False


class DepartmentCreateRequest(BaseModel):
    name: str
    code: str
    hod_name: Optional[str] = ""


class SubjectCreateRequest(BaseModel):
    name: str
    code: str
    department_id: int
    semester: int
    teacher_id: int
    schedule_slot: str


class ParentSettingUpdateRequest(BaseModel):
    parent_name: Optional[str] = ""
    parent_email: Optional[str] = ""
    parent_phone: Optional[str] = ""
    notify_parent_email: bool = True
    notify_redline_alerts: bool = True


# ============================================================================
# 6. AUTHENTICATION ENDPOINTS
# ============================================================================
@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.strip().lower()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    dept = db.query(Department).filter_by(id=user.department_id).first()
    token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "roll_or_emp_id": user.roll_or_emp_id,
            "department_id": user.department_id,
            "department_name": dept.name if dept else "Computer Science & Engineering",
            "year": user.year,
            "semester": user.semester,
        },
    }


@app.post("/api/auth/register")
def register_user(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email is already registered")
    if db.query(User).filter(User.roll_or_emp_id == req.roll_or_emp_id).first():
        raise HTTPException(status_code=400, detail="Roll Number / Employee ID already exists")

    user = User(
        full_name=req.full_name,
        email=req.email.lower(),
        password_hash=hash_password(req.password),
        role=req.role,
        roll_or_emp_id=req.roll_or_emp_id,
        department_id=req.department_id,
        year=req.year,
        semester=req.semester,
        parent_name=req.parent_name,
        parent_email=req.parent_email,
        parent_phone=req.parent_phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "Account registered successfully", "user_id": user.id}


@app.get("/api/demo-accounts")
def list_demo_accounts(db: Session = Depends(get_db)):
    """Returns quick-switch accounts for effortless presentation demonstration."""
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "roll_or_emp_id": u.roll_or_emp_id,
            "default_password": f"{u.role}123",
        }
        for u in users
    ]


# ============================================================================
# 7. MODULE 1: FULL-DAY ATTENDANCE ALERT SYSTEM & ATTENDANCE MARKING
# ============================================================================
@app.post("/api/attendance/mark")
def mark_class_attendance(req: MarkAttendanceBatchRequest, db: Session = Depends(get_db)):
    subj = db.query(Subject).filter_by(id=req.subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")

    updated_count = 0
    consolidated_alerts_triggered = []
    redline_updates = []

    for item in req.records:
        # Calculate previous attendance % before update
        prev_records = db.query(AttendanceRecord).filter_by(student_id=item.student_id).all()
        prev_pct = (
            round((sum(1 for r in prev_records if r.status == "Present") / len(prev_records)) * 100, 2)
            if prev_records else 100.0
        )

        existing = db.query(AttendanceRecord).filter_by(
            student_id=item.student_id,
            subject_id=req.subject_id,
            attendance_date=req.attendance_date,
        ).first()

        if existing:
            existing.status = item.status
            existing.remarks = item.remarks
            existing.marked_by = req.teacher_id
        else:
            new_rec = AttendanceRecord(
                student_id=item.student_id,
                subject_id=req.subject_id,
                attendance_date=req.attendance_date,
                status=item.status,
                marked_by=req.teacher_id,
                remarks=item.remarks,
            )
            db.add(new_rec)
        updated_count += 1
        db.commit()

        # Check Full-Day Consolidated Absence Alert (only 1 email per day if absent for all classes)
        if req.trigger_full_day_check:
            alert = evaluate_full_day_absence_alert(db, item.student_id, req.attendance_date)
            if alert:
                consolidated_alerts_triggered.append(alert.id)

        # Check RED LINE status transition (<75% warning or >=75% recovery)
        rl_notif = evaluate_redline_status_change(db, item.student_id, previous_pct=prev_pct)
        if rl_notif:
            redline_updates.append(rl_notif.id)

    return {
        "message": f"Attendance recorded for {updated_count} students in {subj.name}.",
        "consolidated_daily_alerts_sent": len(consolidated_alerts_triggered),
        "redline_notifications_generated": len(redline_updates),
    }


@app.post("/api/alerts/full-day-scan")
def run_full_day_absence_scan(scan_date: Optional[date] = None, db: Session = Depends(get_db)):
    """
    Scans all students for a given date (or all historical dates if omitted) and generates
    strictly ONE consolidated daily absence email per student who was absent for the entire day.
    """
    students = db.query(User).filter_by(role="student").all()
    if scan_date:
        dates_to_check = [scan_date]
    else:
        distinct_dates = db.query(AttendanceRecord.attendance_date).distinct().all()
        dates_to_check = [d[0] for d in distinct_dates]

    new_alerts = []
    for d in dates_to_check:
        for s in students:
            before_count = db.query(DailyAbsenceNotification).filter_by(student_id=s.id, absence_date=d).count()
            alert = evaluate_full_day_absence_alert(db, s.id, d)
            if alert and before_count == 0:
                new_alerts.append({
                    "alert_id": alert.id,
                    "student_name": s.full_name,
                    "absence_date": d.isoformat(),
                    "parent_email": alert.parent_email,
                })

    return {
        "message": f"Full-day consolidated attendance scan complete. {len(new_alerts)} new daily parent alert(s) dispatched.",
        "new_alerts": new_alerts,
    }


@app.get("/api/alerts/history")
def get_consolidated_alert_history(student_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(DailyAbsenceNotification).order_by(DailyAbsenceNotification.absence_date.desc())
    if student_id:
        query = query.filter_by(student_id=student_id)
    alerts = query.all()
    results = []
    for a in alerts:
        st = db.query(User).filter_by(id=a.student_id).first()
        dept = db.query(Department).filter_by(id=st.department_id).first() if st else None
        results.append({
            "id": a.id,
            "student_id": a.student_id,
            "student_name": st.full_name if st else "Student",
            "roll_number": st.roll_or_emp_id if st else "",
            "department_name": dept.name if dept else "CSE",
            "year": st.year if st else 3,
            "absence_date": a.absence_date.isoformat(),
            "parent_email": a.parent_email,
            "total_classes_scheduled": a.total_classes_scheduled,
            "total_classes_absent": a.total_classes_absent,
            "attendance_status": "Full-Day Absent",
            "email_subject": a.email_subject,
            "email_body": a.email_body,
            "delivery_status": a.delivery_status,
            "sent_at": a.sent_at.strftime("%Y-%m-%d %H:%M"),
        })
    return results


# ============================================================================
# 8. MODULE 2: STUDENT-TEACHER CONNECT (DOUBTS & 2-WAY RATINGS)
# ============================================================================
@app.get("/api/connect/doubts")
def list_doubts(
    student_id: Optional[int] = None,
    teacher_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Doubt).order_by(Doubt.created_at.desc())
    if student_id:
        q = q.filter_by(student_id=student_id)
    if teacher_id:
        q = q.filter_by(teacher_id=teacher_id)
    if status_filter and status_filter != "All":
        q = q.filter_by(status=status_filter)

    items = []
    for d in q.all():
        st = db.query(User).filter_by(id=d.student_id).first()
        tc = db.query(User).filter_by(id=d.teacher_id).first()
        subj = db.query(Subject).filter_by(id=d.subject_id).first()
        items.append({
            "id": d.id,
            "student_id": d.student_id,
            "student_name": st.full_name if st else "Student",
            "student_roll": st.roll_or_emp_id if st else "",
            "teacher_id": d.teacher_id,
            "teacher_name": tc.full_name if tc else "Faculty",
            "subject_id": d.subject_id,
            "subject_name": subj.name if subj else "Subject",
            "subject_code": subj.code if subj else "",
            "title": d.title,
            "description": d.description,
            "attachment_name": d.attachment_name,
            "attachment_url": d.attachment_url,
            "status": d.status,
            "teacher_reply": d.teacher_reply,
            "replied_at": d.replied_at.strftime("%Y-%m-%d %H:%M") if d.replied_at else None,
            "created_at": d.created_at.strftime("%Y-%m-%d %H:%M"),
        })
    return items


@app.post("/api/connect/doubts")
async def create_doubt(
    student_id: int = Form(...),
    subject_id: int = Form(...),
    title: str = Form(...),
    description: str = Form(...),
    attachment: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    subj = db.query(Subject).filter_by(id=subject_id).first()
    if not subj:
        raise HTTPException(status_code=404, detail="Subject not found")

    att_name = None
    att_url = None
    if attachment and attachment.filename:
        safe_name = f"{uuid.uuid4().hex[:8]}_{attachment.filename}"
        dest = os.path.join(UPLOAD_DIR, safe_name)
        with open(dest, "wb") as f:
            f.write(await attachment.read())
        att_name = attachment.filename
        att_url = f"/uploads/{safe_name}"

    doubt = Doubt(
        student_id=student_id,
        subject_id=subject_id,
        teacher_id=subj.teacher_id or 2,
        title=title,
        description=description,
        attachment_name=att_name,
        attachment_url=att_url,
        status="Pending",
    )
    db.add(doubt)
    db.commit()
    db.refresh(doubt)
    return {"message": "Doubt submitted successfully", "id": doubt.id}


@app.put("/api/connect/doubts/{doubt_id}/reply")
def reply_to_doubt(doubt_id: int, req: DoubtReplyRequest, db: Session = Depends(get_db)):
    doubt = db.query(Doubt).filter_by(id=doubt_id).first()
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found")
    doubt.teacher_reply = req.teacher_reply
    doubt.status = req.status
    doubt.replied_at = datetime.utcnow()
    db.commit()
    return {"message": "Reply posted and status updated", "status": doubt.status}


@app.put("/api/connect/doubts/{doubt_id}/status")
def update_doubt_status(doubt_id: int, status: str = Query(...), db: Session = Depends(get_db)):
    doubt = db.query(Doubt).filter_by(id=doubt_id).first()
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found")
    doubt.status = status
    db.commit()
    return {"message": f"Doubt marked as {status}"}


@app.get("/api/connect/ratings")
def list_ratings(direction: Optional[str] = None, to_user_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(RatingFeedback).order_by(RatingFeedback.created_at.desc())
    if direction:
        q = q.filter_by(direction=direction)
    if to_user_id:
        q = q.filter_by(to_user_id=to_user_id)

    results = []
    for r in q.all():
        from_u = db.query(User).filter_by(id=r.from_user_id).first()
        to_u = db.query(User).filter_by(id=r.to_user_id).first()
        subj = db.query(Subject).filter_by(id=r.subject_id).first() if r.subject_id else None
        results.append({
            "id": r.id,
            "from_user_id": r.from_user_id,
            "from_user_name": from_u.full_name if from_u else "User",
            "to_user_id": r.to_user_id,
            "to_user_name": to_u.full_name if to_u else "User",
            "direction": r.direction,
            "subject_name": subj.name if subj else "General Academic",
            "metric_1_score": r.metric_1_score,
            "metric_2_score": r.metric_2_score,
            "metric_3_score": r.metric_3_score,
            "overall_score": round(r.overall_score, 2),
            "comment": r.comment,
            "created_at": r.created_at.strftime("%Y-%m-%d"),
        })
    return results


@app.post("/api/connect/ratings")
def submit_rating(req: RatingCreateRequest, db: Session = Depends(get_db)):
    overall = round((req.metric_1_score + req.metric_2_score + req.metric_3_score) / 3.0, 2)
    rating = RatingFeedback(
        from_user_id=req.from_user_id,
        to_user_id=req.to_user_id,
        direction=req.direction,
        subject_id=req.subject_id,
        metric_1_score=req.metric_1_score,
        metric_2_score=req.metric_2_score,
        metric_3_score=req.metric_3_score,
        overall_score=overall,
        comment=req.comment,
    )
    db.add(rating)
    db.commit()
    db.refresh(rating)
    return {"message": "Rating & feedback submitted successfully", "overall_score": overall}


# ============================================================================
# 9. MODULE 3 & 4: STUDENT ATTENDANCE DASHBOARD & RED LINE WARNING SYSTEM
# ============================================================================
@app.get("/api/students/{student_id}/dashboard")
def get_student_dashboard(student_id: int, db: Session = Depends(get_db)):
    student = db.query(User).filter_by(id=student_id, role="student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    summary = get_student_attendance_summary(db, student)
    redline_notifs = (
        db.query(RedlineNotification)
        .filter_by(student_id=student.id)
        .order_by(RedlineNotification.created_at.desc())
        .all()
    )
    summary["redline_notifications"] = [
        {
            "id": n.id,
            "notification_type": n.notification_type,
            "attendance_percentage": n.attendance_percentage,
            "classes_needed": n.classes_needed,
            "message": n.message,
            "created_at": n.created_at.strftime("%Y-%m-%d %H:%M"),
        }
        for n in redline_notifs
    ]
    return summary


@app.get("/api/redline/overview")
def get_redline_system_overview(db: Session = Depends(get_db)):
    students = db.query(User).filter_by(role="student").all()
    all_summaries = [get_student_attendance_summary(db, s) for s in students]
    redline_students = [s for s in all_summaries if s["overall_percentage"] < 75.0]
    borderline_students = [s for s in all_summaries if 75.0 <= s["overall_percentage"] < 80.0]
    safe_students = [s for s in all_summaries if s["overall_percentage"] >= 80.0]

    recent_notifications = (
        db.query(RedlineNotification)
        .order_by(RedlineNotification.created_at.desc())
        .limit(20)
        .all()
    )
    notif_list = []
    for n in recent_notifications:
        st = db.query(User).filter_by(id=n.student_id).first()
        notif_list.append({
            "id": n.id,
            "student_id": n.student_id,
            "student_name": st.full_name if st else "Student",
            "roll_number": st.roll_or_emp_id if st else "",
            "notification_type": n.notification_type,
            "attendance_percentage": n.attendance_percentage,
            "classes_needed": n.classes_needed,
            "message": n.message,
            "created_at": n.created_at.strftime("%Y-%m-%d %H:%M"),
        })

    return {
        "minimum_required_percentage": 75.0,
        "total_students": len(all_summaries),
        "redline_count": len(redline_students),
        "warning_count": len(borderline_students),
        "safe_count": len(safe_students),
        "redline_students": redline_students,
        "borderline_students": borderline_students,
        "safe_students": safe_students,
        "notifications": notif_list,
    }


@app.post("/api/redline/notify/{student_id}")
def send_manual_redline_warning(student_id: int, db: Session = Depends(get_db)):
    student = db.query(User).filter_by(id=student_id, role="student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    summary = get_student_attendance_summary(db, student)
    pct = summary["overall_percentage"]
    needed = summary["classes_needed_for_75"]

    if pct < 75.0:
        ntype = "WARNING_BELOW_75"
        msg = (
            f"URGENT RED LINE REMINDER: Dear {student.full_name}, your cumulative attendance stands at {pct}% "
            f"(below the mandatory 75% college requirement). You need to attend at least {needed} consecutive classes "
            f"without absence to restore your academic standing."
        )
    else:
        ntype = "RECOVERY_ABOVE_75"
        msg = (
            f"RED LINE CLEARED: Dear {student.full_name}, your attendance is currently {pct}%, which meets the "
            f"75% statutory requirement."
        )

    send_smtp_email(student.email, f"[ATTENDLY RED LINE] Attendance Status Alert ({pct}%)", msg)
    notif = RedlineNotification(
        student_id=student.id,
        notification_type=ntype,
        attendance_percentage=pct,
        classes_needed=needed,
        message=msg,
    )
    db.add(notif)
    db.commit()
    return {"message": "RED LINE notification sent to student", "notification": msg}


# ============================================================================
# 10. MODULE 5: STUDENT ATTENDANCE ISSUE & LEAVE EXPLANATION
# ============================================================================
@app.get("/api/leaves")
def list_leave_explanations(student_id: Optional[int] = None, status_filter: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(LeaveExplanation).order_by(LeaveExplanation.created_at.desc())
    if student_id:
        q = q.filter_by(student_id=student_id)
    if status_filter and status_filter != "All":
        q = q.filter_by(status=status_filter)

    items = []
    for lv in q.all():
        st = db.query(User).filter_by(id=lv.student_id).first()
        subj = db.query(Subject).filter_by(id=lv.subject_id).first() if lv.subject_id else None
        rev = db.query(User).filter_by(id=lv.reviewer_id).first() if lv.reviewer_id else None
        items.append({
            "id": lv.id,
            "student_id": lv.student_id,
            "student_name": st.full_name if st else "Student",
            "roll_number": st.roll_or_emp_id if st else "",
            "subject_id": lv.subject_id,
            "subject_name": subj.name if subj else "Full Day / All Subjects",
            "absence_date": lv.absence_date.isoformat(),
            "reason_category": lv.reason_category,
            "explanation_text": lv.explanation_text,
            "document_name": lv.document_name,
            "document_url": lv.document_url,
            "status": lv.status,
            "reviewer_name": rev.full_name if rev else None,
            "reviewer_comment": lv.reviewer_comment,
            "convert_to_present": lv.convert_to_present,
            "reviewed_at": lv.reviewed_at.strftime("%Y-%m-%d %H:%M") if lv.reviewed_at else None,
            "created_at": lv.created_at.strftime("%Y-%m-%d %H:%M"),
        })
    return items


@app.post("/api/leaves")
async def submit_leave_explanation(
    student_id: int = Form(...),
    absence_date: date = Form(...),
    reason_category: str = Form(...),
    explanation_text: str = Form(...),
    subject_id: Optional[int] = Form(None),
    document: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """
    Important College Policy: Submitting an explanation does NOT automatically convert
    an absent record into present attendance. It starts in 'Pending' status for review.
    """
    doc_name = None
    doc_url = None
    if document and document.filename:
        safe_name = f"leave_{uuid.uuid4().hex[:8]}_{document.filename}"
        dest = os.path.join(UPLOAD_DIR, safe_name)
        with open(dest, "wb") as f:
            f.write(await document.read())
        doc_name = document.filename
        doc_url = f"/uploads/{safe_name}"

    leave = LeaveExplanation(
        student_id=student_id,
        subject_id=subject_id,
        absence_date=absence_date,
        reason_category=reason_category,
        explanation_text=explanation_text,
        document_name=doc_name,
        document_url=doc_url,
        status="Pending",
        convert_to_present=False,
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)
    return {
        "message": "Absence explanation submitted for faculty review. Note: Attendance remains unchanged until authorized review.",
        "id": leave.id,
    }


@app.put("/api/leaves/{leave_id}/review")
def review_leave_explanation(leave_id: int, req: LeaveReviewRequest, db: Session = Depends(get_db)):
    leave = db.query(LeaveExplanation).filter_by(id=leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave explanation not found")

    leave.status = req.status
    leave.reviewer_id = req.reviewer_id
    leave.reviewer_comment = req.reviewer_comment
    leave.convert_to_present = req.convert_to_present
    leave.reviewed_at = datetime.utcnow()

    # Only if authorized faculty/admin explicitly approves attendance conversion per college policy:
    converted_records = 0
    if req.status == "Approved" and req.convert_to_present:
        q = db.query(AttendanceRecord).filter_by(
            student_id=leave.student_id,
            attendance_date=leave.absence_date,
            status="Absent",
        )
        if leave.subject_id:
            q = q.filter_by(subject_id=leave.subject_id)
        for rec in q.all():
            rec.status = "Present"
            rec.remarks = f"Approved Leave Condonation ({leave.reason_category})"
            converted_records += 1

    db.commit()
    evaluate_redline_status_change(db, leave.student_id, previous_pct=70.0)
    return {
        "message": f"Leave explanation {req.status}. Converted {converted_records} attendance record(s).",
        "status": leave.status,
        "converted_records": converted_records,
    }


# ============================================================================
# 11. MODULE 6: ADMIN & FACULTY MANAGEMENT DASHBOARD + PDF/EXCEL EXPORTS
# ============================================================================
@app.get("/api/admin/overview")
def get_admin_dashboard_overview(db: Session = Depends(get_db)):
    departments = db.query(Department).all()
    users = db.query(User).all()
    subjects = db.query(Subject).all()
    students = [u for u in users if u.role == "student"]
    teachers = [u for u in users if u.role == "teacher"]

    student_summaries = [get_student_attendance_summary(db, s) for s in students]
    redline_students = [s for s in student_summaries if s["overall_percentage"] < 75.0]
    pending_leaves = db.query(LeaveExplanation).filter_by(status="Pending").count()
    total_alerts = db.query(DailyAbsenceNotification).count()

    avg_attendance = (
        round(sum(s["overall_percentage"] for s in student_summaries) / len(student_summaries), 2)
        if student_summaries else 100.0
    )

    return {
        "total_students": len(students),
        "total_teachers": len(teachers),
        "total_departments": len(departments),
        "total_subjects": len(subjects),
        "average_college_attendance": avg_attendance,
        "redline_student_count": len(redline_students),
        "pending_leave_explanations": pending_leaves,
        "consolidated_alerts_sent": total_alerts,
        "students": student_summaries,
        "teachers": [
            {
                "id": t.id,
                "full_name": t.full_name,
                "email": t.email,
                "roll_or_emp_id": t.roll_or_emp_id,
                "department_id": t.department_id,
            }
            for t in teachers
        ],
        "departments": [
            {"id": d.id, "name": d.name, "code": d.code, "hod_name": d.hod_name}
            for d in departments
        ],
        "subjects": [
            {
                "id": sub.id,
                "name": sub.name,
                "code": sub.code,
                "department_id": sub.department_id,
                "semester": sub.semester,
                "teacher_id": sub.teacher_id,
                "schedule_slot": sub.schedule_slot,
            }
            for sub in subjects
        ],
    }


@app.get("/api/attendance/class-sheet")
def get_class_attendance_sheet(
    subject_id: int = Query(...),
    attendance_date: date = Query(...),
    db: Session = Depends(get_db),
):
    students = db.query(User).filter_by(role="student").order_by(User.roll_or_emp_id.asc()).all()
    sheet = []
    for s in students:
        rec = db.query(AttendanceRecord).filter_by(
            student_id=s.id, subject_id=subject_id, attendance_date=attendance_date
        ).first()
        summary = get_student_attendance_summary(db, s)
        sheet.append({
            "student_id": s.id,
            "full_name": s.full_name,
            "roll_number": s.roll_or_emp_id,
            "status": rec.status if rec else "Present",
            "already_marked": rec is not None,
            "remarks": rec.remarks if rec else "",
            "overall_percentage": summary["overall_percentage"],
            "status_color": summary["status_color"],
        })
    return sheet


@app.post("/api/admin/users")
def admin_create_user(req: RegisterRequest, db: Session = Depends(get_db)):
    return register_user(req, db)


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: int, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(id=user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if u.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete primary admin account")
    db.delete(u)
    db.commit()
    return {"message": f"Deleted {u.full_name}"}


@app.put("/api/admin/students/{student_id}/parent-settings")
def update_parent_notification_settings(
    student_id: int, req: ParentSettingUpdateRequest, db: Session = Depends(get_db)
):
    st = db.query(User).filter_by(id=student_id, role="student").first()
    if not st:
        raise HTTPException(status_code=404, detail="Student not found")
    st.parent_name = req.parent_name
    st.parent_email = req.parent_email
    st.parent_phone = req.parent_phone
    st.notify_parent_email = req.notify_parent_email
    st.notify_redline_alerts = req.notify_redline_alerts
    db.commit()
    return {"message": "Parent contact and alert preferences updated"}


@app.post("/api/admin/departments")
def create_department(req: DepartmentCreateRequest, db: Session = Depends(get_db)):
    dept = Department(name=req.name, code=req.code, hod_name=req.hod_name)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return {"message": "Department created", "id": dept.id}


@app.post("/api/admin/subjects")
def create_subject(req: SubjectCreateRequest, db: Session = Depends(get_db)):
    subj = Subject(
        name=req.name,
        code=req.code,
        department_id=req.department_id,
        semester=req.semester,
        teacher_id=req.teacher_id,
        schedule_slot=req.schedule_slot,
    )
    db.add(subj)
    db.commit()
    db.refresh(subj)
    return {"message": "Subject & schedule created", "id": subj.id}


@app.get("/api/admin/reports/export")
def export_attendance_report(format: str = Query("excel"), db: Session = Depends(get_db)):
    """
    Generates downloadable Attendance Reports in Excel (CSV/XLSX compatible) or PDF format.
    """
    students = db.query(User).filter_by(role="student").order_by(User.roll_or_emp_id.asc()).all()
    summaries = [get_student_attendance_summary(db, s) for s in students]

    if format.lower() in ("excel", "csv"):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Roll Number",
            "Student Name",
            "Department",
            "Semester",
            "Total Classes",
            "Attended",
            "Missed",
            "Attendance %",
            "Status Indicator",
            "RED LINE Status",
            "Classes Needed for 75%",
            "Parent Email",
        ])
        for s in summaries:
            writer.writerow([
                s["roll_number"],
                s["full_name"],
                s["department_code"],
                s["semester"],
                s["total_classes"],
                s["attended_classes"],
                s["missed_classes"],
                f"{s['overall_percentage']}%",
                s["status_color"],
                "RED LINE WARNING (<75%)" if s["is_redline"] else "SAFE (>=75%)",
                s["classes_needed_for_75"],
                s["parent_email"] or "N/A",
            ])
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=ATTENDLY_Attendance_Report.csv"},
        )

    # Generate clean, standalone PDF binary report without external OS font dependencies
    lines = [
        "ATTENDLY - SMART STUDENT ATTENDANCE & MANAGEMENT SYSTEM",
        f"Official Consolidated Attendance Report | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "--------------------------------------------------------------------------------",
        f"{'Roll No':<10} {'Student Name':<22} {'Dept':<6} {'Attended':<10} {'Pct %':<8} {'Status':<12} {'Need(75%)'}",
        "--------------------------------------------------------------------------------",
    ]
    for s in summaries:
        status_tag = "RED LINE" if s["is_redline"] else s["status_color"].upper()
        lines.append(
            f"{s['roll_number']:<10} {s['full_name'][:20]:<22} {s['department_code']:<6} "
            f"{s['attended_classes']}/{s['total_classes']:<6} {s['overall_percentage']:<7}% {status_tag:<12} +{s['classes_needed_for_75']} classes"
        )
    lines.append("--------------------------------------------------------------------------------")
    lines.append("Minimum Required Attendance: 75.0% | Automated Consolidated Parent Alerts: Active")

    pdf_bytes = build_simple_pdf(lines)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=ATTENDLY_Attendance_Report.pdf"},
    )


def build_simple_pdf(text_lines: List[str]) -> bytes:
    """Builds a valid, standards-compliant PDF document in pure Python."""
    escaped_lines = [
        line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        for line in text_lines
    ]
    content_ops = ["BT", "/F1 10 Tf", "40 760 Td", "14 TL"]
    for idx, line in enumerate(escaped_lines):
        if idx == 0:
            content_ops.append(f"({line}) Tj")
        else:
            content_ops.append(f"T* ({line}) Tj")
    content_ops.append("ET")
    stream_data = "\n".join(content_ops).encode("latin-1", errors="replace")

    objects = [
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
        b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n",
        f"5 0 obj\n<< /Length {len(stream_data)} >>\nstream\n".encode("latin-1") + stream_data + b"\nendstream\nendobj\n",
    ]

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj)

    xref_pos = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("latin-1"))
    for off in offsets[1:]:
        pdf.extend(f"{off:010d} 00000 n \n".encode("latin-1"))
    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode("latin-1")
    )
    return bytes(pdf)
