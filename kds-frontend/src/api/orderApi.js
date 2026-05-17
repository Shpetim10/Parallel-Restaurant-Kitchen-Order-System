import axios from 'axios'

const BASE = '/api/orders'

export const fetchAllOrders = () => axios.get(BASE).then(r => r.data)
export const fetchOrder = id => axios.get(`${BASE}/${id}`).then(r => r.data)
export const fetchStats = () => axios.get(`${BASE}/stats`).then(r => r.data)
export const fetchMenu = () => axios.get(`${BASE}/menu`).then(r => r.data)
export const submitOrder = body => axios.post(BASE, body).then(r => r.data)
export const collectOrder = (id, timeout = 30000) =>
  axios.post(`${BASE}/${id}/collect?timeoutMs=${timeout}`).then(r => r.data)
export const cancelOrder = id => axios.delete(`${BASE}/${id}`)
