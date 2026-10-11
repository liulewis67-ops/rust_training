import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './styles.css'
import './theme.css'
import './styles/accessibility.css'

const root = document.getElementById('root')
if (!root) throw new Error('应用挂载节点 #root 不存在')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
