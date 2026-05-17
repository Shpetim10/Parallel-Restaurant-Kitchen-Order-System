import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { KitchenProvider } from './context/KitchenContext'
import Navbar from './components/Navbar'
import ConnectionBanner from './components/ConnectionBanner'
import ToastContainer from './components/ToastContainer'
import KitchenDisplay from './pages/KitchenDisplay'
import ManagerDashboard from './pages/ManagerDashboard'
import { useKitchen } from './context/KitchenContext'
import './styles/globals.css'

function AppInner() {
  const { state, toast } = useKitchen()

  return (
    <>
      <ConnectionBanner status={state.connectionStatus} />
      <Navbar />
      <main style={{ paddingTop: '56px' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/kitchen" replace />} />
          <Route path="/kitchen" element={<KitchenDisplay />} />
          <Route path="/manager" element={<ManagerDashboard />} />
        </Routes>
      </main>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </>
  )
}

export default function App() {
  return (
    <KitchenProvider>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </KitchenProvider>
  )
}
