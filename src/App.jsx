import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import StudentLogin from './pages/StudentLogin';
import TeacherAuth from './pages/TeacherAuth';
import TeacherDashboard from './pages/TeacherDashboard';
import CreateExam from './pages/CreateExam';
import ExamRoom from './pages/ExamRoom';
import LiveExamDashboard from './pages/LiveExamDashboard';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/student/login" element={<StudentLogin />} />
        <Route path="/teacher/auth" element={<TeacherAuth />} />
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
        <Route path="/teacher/create-exam" element={<CreateExam />} />
        <Route path="/teacher/live/:sessionId" element={<LiveExamDashboard />} />
        <Route path="/exam/:sessionCode" element={<ExamRoom />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
