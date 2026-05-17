import axios from 'axios'

const BASE = '/api/stations'

export const fetchAllStations = () => axios.get(BASE).then(r => r.data)
export const fetchStation = type => axios.get(`${BASE}/${type}`).then(r => r.data)
export const updateCapacity = (type, capacity) =>
  axios.put(`${BASE}/${type}/capacity`, { capacity }).then(r => r.data)
export const fetchThreadCounts = () => axios.get(`${BASE}/threads`).then(r => r.data)
