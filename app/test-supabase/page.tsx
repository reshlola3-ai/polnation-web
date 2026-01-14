'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export default function TestSupabase() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('正在测试连接...')
  const [details, setDetails] = useState<any>(null)

  useEffect(() => {
    async function testConnection() {
      try {
        // 测试 1: 检查 Supabase 客户端是否初始化
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseKey) {
          setStatus('error')
          setMessage('❌ 环境变量未配置')
          setDetails({
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseKey,
            url: supabaseUrl || '未设置',
            keyPrefix: supabaseKey ? supabaseKey.substring(0, 20) + '...' : '未设置'
          })
          return
        }

        // 测试 2: 尝试连接 Supabase
        const { data, error } = await supabase
          .from('_test_connection')
          .select('count')
          .limit(1)

        // 即使表不存在，如果连接成功，error 会是特定的错误类型
        if (error) {
          // 如果是 "relation does not exist" 错误，说明连接成功但表不存在（这是正常的）
          if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
            setStatus('success')
            setMessage('✅ Supabase 连接成功！')
            setDetails({
              url: supabaseUrl,
              keyPrefix: supabaseKey.substring(0, 20) + '...',
              error: '表不存在（这是正常的，说明连接成功）',
              errorCode: error.code
            })
          } else {
            setStatus('error')
            setMessage('❌ 连接失败')
            setDetails({
              error: error.message,
              errorCode: error.code,
              errorDetails: error
            })
          }
        } else {
          setStatus('success')
          setMessage('✅ Supabase 连接成功！')
          setDetails({
            url: supabaseUrl,
            keyPrefix: supabaseKey.substring(0, 20) + '...',
            data: data
          })
        }
      } catch (err: any) {
        setStatus('error')
        setMessage('❌ 连接测试失败')
        setDetails({
          error: err.message || '未知错误',
          stack: err.stack
        })
      }
    }

    testConnection()
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black p-8">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6 text-black dark:text-zinc-50">
          Supabase 连接测试
        </h1>

        <div className="mb-6">
          <div className={`p-4 rounded-lg ${
            status === 'loading' ? 'bg-blue-50 dark:bg-blue-900/20' :
            status === 'success' ? 'bg-green-50 dark:bg-green-900/20' :
            'bg-red-50 dark:bg-red-900/20'
          }`}>
            <p className={`text-lg font-semibold ${
              status === 'loading' ? 'text-blue-700 dark:text-blue-300' :
              status === 'success' ? 'text-green-700 dark:text-green-300' :
              'text-red-700 dark:text-red-300'
            }`}>
              {message}
            </p>
          </div>
        </div>

        {details && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4 text-black dark:text-zinc-50">
              详细信息
            </h2>
            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 overflow-auto">
              <pre className="text-sm text-zinc-800 dark:text-zinc-200">
                {JSON.stringify(details, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div className="mt-6">
          <a
            href="/"
            className="inline-block px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            返回首页
          </a>
        </div>
      </div>
    </div>
  )
}
