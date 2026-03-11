import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/Layout/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import RequestsPage from './pages/Requests/index'
import CandidatesPage from './pages/Candidates/index'
import ApplicationsPage from './pages/Applications/index'
import InterviewsPage from './pages/Interviews/index'
import TestAssignmentsPage from './pages/TestAssignments/index'
import OffersPage from './pages/Offers/index'
import WorkplaceTasksPage from './pages/WorkplaceTasks/index'
import TemplatesPage from './pages/Templates/index'
import ClassifiersPage from './pages/Classifiers/index'
import UsersPage from './pages/Users'
import ApprovalsPage from './pages/Approvals'

function ProtectedLayout({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
          <Route path="/requests" element={<ProtectedLayout><RequestsPage /></ProtectedLayout>} />
          <Route path="/candidates" element={<ProtectedLayout><CandidatesPage /></ProtectedLayout>} />
          <Route path="/applications" element={<ProtectedLayout><ApplicationsPage /></ProtectedLayout>} />
          <Route path="/interviews" element={<ProtectedLayout><InterviewsPage /></ProtectedLayout>} />
          <Route path="/test-assignments" element={<ProtectedLayout><TestAssignmentsPage /></ProtectedLayout>} />
          <Route path="/offers" element={<ProtectedLayout><OffersPage /></ProtectedLayout>} />
          <Route path="/workplace-tasks" element={<ProtectedLayout><WorkplaceTasksPage /></ProtectedLayout>} />
          <Route path="/templates" element={<ProtectedLayout><TemplatesPage /></ProtectedLayout>} />
          <Route path="/classifiers" element={<ProtectedLayout><ClassifiersPage /></ProtectedLayout>} />
          <Route path="/users" element={<ProtectedLayout><UsersPage /></ProtectedLayout>} />
          <Route path="/approvals" element={<ProtectedLayout><ApprovalsPage /></ProtectedLayout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
