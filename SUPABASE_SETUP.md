# Supabase 配置说明

## 1. 获取 Supabase 凭证

1. 登录 [Supabase Dashboard](https://app.supabase.com/)
2. 选择你的项目
3. 进入 **Settings** → **API**
4. 复制以下信息：
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - （可选）**service_role key** → `SUPABASE_SERVICE_ROLE_KEY`（仅用于服务端，不要暴露给客户端）

## 2. 本地开发环境配置

在项目根目录创建 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. Vercel 环境变量配置

### 方法一：通过 Vercel 网站

1. 进入你的 Vercel 项目页面
2. 点击 **Settings** → **Environment Variables**
3. 添加以下变量：
   - `NEXT_PUBLIC_SUPABASE_URL` = 你的 Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = 你的 anon key
   - （可选）`SUPABASE_SERVICE_ROLE_KEY` = 你的 service_role key
4. 选择环境（Production, Preview, Development）
5. 点击 **Save**
6. 重新部署项目（Vercel 会自动触发）

### 方法二：通过 Vercel CLI

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## 4. 使用示例

### 客户端组件中使用

```typescript
'use client'

import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export default function MyComponent() {
  const [data, setData] = useState([])

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('your_table')
        .select('*')
      
      if (error) {
        console.error('Error:', error)
      } else {
        setData(data)
      }
    }
    
    fetchData()
  }, [])

  return <div>{/* 你的 UI */}</div>
}
```

### 服务端组件或 API 路由中使用

```typescript
import { createServerClient } from '@/lib/supabase-server'

// 在 Server Component 中
export default async function ServerComponent() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('your_table')
    .select('*')
  
  return <div>{/* 你的 UI */}</div>
}

// 在 API Route 中 (app/api/example/route.ts)
import { createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('your_table')
    .select('*')
  
  return NextResponse.json({ data, error })
}
```

## 5. 安全提示

- ✅ `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 可以暴露给客户端（它们有 RLS 保护）
- ❌ `SUPABASE_SERVICE_ROLE_KEY` **绝对不能**暴露给客户端，只能在服务端使用
- ✅ 使用 Row Level Security (RLS) 策略保护你的数据
