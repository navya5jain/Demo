# ATTENDLY – Smart Student Attendance & Management System

**Live Deployed Application:** https://cozy-axolotl-e4d544.netlify.app

## Project Overview

**ATTENDLY** is a modern, responsive, role-based college attendance and academic management web application designed to make attendance tracking smarter, more transparent, and student-friendly. Built with a **Navy Blue, Crisp White, and Subtle Purple** theme, the platform connects **Students**, **Teachers (Faculty)**, and **Administrators** in one unified workflow.

## Key Features & 6 Core Modules

### 1. Full-Day Attendance Alert System (Consolidated Parent Notifications)
- **Automated Full-Day Tracking:** Tracks student attendance across all scheduled classes throughout the entire college day.
- **Zero Per-Class Spam:** Suppresses separate emails for individual absent classes.
- **Single Consolidated Daily Email:** Generates and dispatches **only one consolidated daily absence notification** per student to their registered parents when the student is absent for the whole day.
- **Complete Notification Payload:** Includes Student Name, Roll Number, Date, Department, Academic Year/Semester, and Attendance Status.
- **Notification History & Email Viewer:** Maintains a full audit log of sent alerts with an in-app email preview modal.

### 2. Student-Teacher Connect (Interactive Doubt Portal & 2-Way Ratings)
- **Subject-Related Doubt Submission:** Students can ask subject-specific doubts by sending text descriptions along with images, screenshots, or PDF documents.
- **Doubt Resolution Workflow:** Teachers can reply to student queries and update doubt status across **Pending**, **Answered**, and **Resolved**.
- **Bidirectional Ratings & Continuous Feedback:**
  - **Student → Teacher Ratings:** Students rate teachers (1–5 stars + feedback) on *Teaching Quality*, *Doubt-Solving*, and *Helpfulness*.
  - **Teacher → Student Ratings:** Teachers rate students (1–5 stars + feedback) on *Participation*, *Discipline*, and *Academic Engagement*.

### 3. Student Attendance Dashboard
- **Individual Student Analytics:** Displays subject-wise attendance percentages alongside cumulative totals for classes conducted, attended, and missed.
- **Interactive Charts & Graphs:**
  - **Subject-Wise Attendance Bar Chart:** Compares subject percentages against the 75% mandatory threshold.
  - **Monthly & Semester-Wise Trend Chart:** Tracks monthly attendance performance across the semester.
- **Color-Coded Visual Indicators:**
  - **Green (`>= 80%`):** Good attendance
  - **Yellow (`75% – 79.9%`):** Attendance warning
  - **Red (`< 75%`):** Low attendance (RED LINE critical zone)

### 4. RED LINE – Attendance Warning System (`< 75%`)
- **Dedicated RED LINE Dashboard:** Enforces the college's minimum **75%** attendance requirement and automatically activates a warning status if a student falls below 75%.
- **Exact Recovery Class Calculator:** Calculates and displays the exact number of additional consecutive classes a student needs to attend to reach the 75% requirement (`max(0, 3 * total - 4 * attended)`).
- **Interactive "What-If" Recovery Simulator:** Lets students slide an upcoming-classes counter to preview how attending consecutive classes improves their percentage.
- **Automated Warning & Recovery Notifications:** Sends regular reminders while below 75% and notifies the student automatically once their attendance recovers above the 75% threshold.

### 5. Student Attendance Issue & Leave Explanation
- **Structured Absence Explanations:** Allows students to submit an explanation for specific absence dates with categorized reasons:
  - *Medical Emergency*
  - *Health Issues*
  - *Family Emergency*
  - *Personal Reasons*
  - *Other*
- **Supporting Document Upload:** Students can attach medical certificates or supporting documents for verification.
- **Review Status Tracking:** Displays **Pending**, **Approved**, and **Rejected** statuses and notifies students when reviewed.
- **Strict College Policy Enforcement:** Submitting an explanation **does not automatically convert an Absent record into Present attendance**. Only authorized faculty or administrators can explicitly approve attendance condonation during review according to college policy.

### 6. Admin & Faculty Management Dashboard
- **Role-Based Access Control (RBAC):** Dedicated dashboards and permissions for **Students**, **Teachers**, and **Administrators**, plus a 1-click presentation role switcher.
- **Live Class Attendance Roll-Call:** Teachers can mark daily attendance (`Present` / `Absent`) for their assigned classes with instant recalculation of percentages and alerts.
- **Account & Curriculum Management:** Admin can add, edit, and remove student and teacher accounts, and manage departments, semesters, subjects, and class schedules.
- **Parent Email & Alert Settings:** Manage parent contact emails and toggle automated notification preferences.
- **Downloadable PDF & Excel Reports:** Generate and export department-wide and student-wise attendance reports in **PDF** and **Excel (CSV)** formats.

## Technology Stack

- **Frontend:** React.js 18, Tailwind CSS, Interactive SVG & Recharts Charts
- **Backend:** Python 3, FastAPI, SQLAlchemy ORM, JWT Role-Based Auth, SMTP Email Service
- **Database:** PostgreSQL / MySQL (`database/schema.sql`) with automatic local SQLite fallback
- **Live Deployment:** [https://fanciful-halva-73c6e6.netlify.app](https://fanciful-halva-73c6e6.netlify.app)

## Demo Login Credentials

| Role | Name | Email | Password | Highlights |
| :--- | :--- | :--- | :--- | :--- |
| **Student (RED LINE)** | Aarav Sharma | `aarav@attendly.edu` | `student123` | **68% Attendance** (Active RED LINE warning & recovery calculator) |
| **Student (Good)** | Priya Nair | `priya@attendly.edu` | `student123` | **92% Attendance** (Green indicator standing) |
| **Student (Warning)** | Rohan Verma | `rohan.v@attendly.edu` | `student123` | **76% Attendance** (Yellow warning standing) |
| **Teacher / Faculty** | Prof. Ananya Deshmukh | `ananya@attendly.edu` | `teacher123` | Mark class attendance, reply to doubts, review leave requests |
| **Administrator** | Dr. Rajeshwari Kulkarni | `admin@attendly.edu` | `admin123` | Manage users/subjects, parent settings, export PDF & Excel reports |

## Project Folder Structure

```text
attendly/
├── README.md                      # Project overview, features & live Netlify link
├── netlify-drop/
│   └── index.html                 # Standalone zero-build production app deployed on Netlify
├── database/
│   └── schema.sql                 # PostgreSQL & MySQL compatible database schema
├── backend/
│   ├── .env.example               # Database, JWT & SMTP configuration template
│   ├── requirements.txt           # Python FastAPI & SQLAlchemy dependencies
│   ├── main.py                    # Complete FastAPI backend & auto-seeding engine
│   └── uploads/                   # Uploaded medical certificates & doubt attachments
└── frontend/
    ├── package.json               # React 18, Tailwind CSS, Recharts, Lucide Icons
    ├── vite.config.js             # Vite configuration
    ├── tailwind.config.js         # Navy blue, white & purple accent theme config
    ├── postcss.config.js          # PostCSS configuration
    ├── index.html                 # Vite HTML entry point
    └── src/
        ├── main.jsx               # React root mount
        ├── index.css              # Tailwind CSS directives
        └── App.jsx                # Full React application across all 6 modules
```

## How to Run Locally in VS Code

1. **Start the Python FastAPI Backend (Terminal 1):**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate   # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```
2. **Start the React + Tailwind CSS Frontend (Terminal 2):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser (or visit the live deployment at [https://fanciful-halva-73c6e6.netlify.app](https://fanciful-halva-73c6e6.netlify.app)).
