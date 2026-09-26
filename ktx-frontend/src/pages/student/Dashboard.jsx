import StudentDashboard from './StudentDashboard';
import './StudentDashboard.css';

/**
 * Dashboard component - Alias / Wrapper cho StudentDashboard
 * Khớp 100% bản Figma
 */
export default function Dashboard(props) {
  return <StudentDashboard {...props} />;
}
