import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import App from './App'
import './index.css'

dayjs.locale('ru')

ReactDOM.createRoot(document.getElementById('root')).render(
  <ConfigProvider
    locale={ruRU}
    theme={{
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 8,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }
    }}
  >
    <App />
  </ConfigProvider>
)
