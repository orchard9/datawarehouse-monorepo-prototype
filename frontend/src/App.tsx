import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MarketingDashboard from '@/components/MarketingDashboard'
import DataWarehouseDashboard from '@pages/DataWarehouseDashboard'
import CampaignDetailsPage from '@pages/CampaignDetailsPage'
import Layout from '@components/Layout'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<MarketingDashboard />} />
          <Route path="/datawarehouse" element={<DataWarehouseDashboard />} />
          <Route path="/campaigns/:id" element={<CampaignDetailsPage />} />
          <Route path="/campaigns" element={<MarketingDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App