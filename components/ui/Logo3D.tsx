'use client'

import { useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { 
  MeshDistortMaterial, 
  Float, 
  Environment,
  Text3D,
  Center
} from '@react-three/drei'
import * as THREE from 'three'

function Coin() {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      // 自动旋转
      meshRef.current.rotation.y += 0.005
      // 轻微上下浮动
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1
    }
    if (glowRef.current) {
      glowRef.current.rotation.y += 0.005
      glowRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1
    }
  })

  return (
    <Float
      speed={2}
      rotationIntensity={0.2}
      floatIntensity={0.3}
    >
      <group>
        {/* 外发光 */}
        <mesh ref={glowRef} scale={1.15}>
          <cylinderGeometry args={[1.8, 1.8, 0.15, 64]} />
          <meshBasicMaterial 
            color="#9333ea" 
            transparent 
            opacity={0.15}
          />
        </mesh>

        {/* 主硬币体 */}
        <mesh ref={meshRef} castShadow receiveShadow>
          <cylinderGeometry args={[1.7, 1.7, 0.25, 64]} />
          <MeshDistortMaterial
            color="#7c3aed"
            metalness={0.9}
            roughness={0.1}
            distort={0}
            speed={0}
          />
        </mesh>

        {/* 硬币边缘 - 金色装饰 */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.7, 0.08, 16, 64]} />
          <meshStandardMaterial 
            color="#fbbf24" 
            metalness={1} 
            roughness={0.2}
          />
        </mesh>

        {/* 正面 "P" 字母 */}
        <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.4, 64]} />
          <meshStandardMaterial 
            color="#4c1d95" 
            metalness={0.8} 
            roughness={0.3}
          />
        </mesh>

        {/* 背面装饰 */}
        <mesh position={[0, -0.13, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.4, 64]} />
          <meshStandardMaterial 
            color="#4c1d95" 
            metalness={0.8} 
            roughness={0.3}
          />
        </mesh>

        {/* 内圈装饰 - 正面 */}
        <mesh position={[0, 0.135, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 1.25, 64]} />
          <meshStandardMaterial 
            color="#9333ea" 
            metalness={0.9} 
            roughness={0.2}
            emissive="#9333ea"
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* 中心 "P" 标志 - 使用几何形状 */}
        <group position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          {/* P 的竖线 */}
          <mesh position={[-0.3, 0, 0.02]}>
            <boxGeometry args={[0.2, 1.2, 0.04]} />
            <meshStandardMaterial 
              color="#c4b5fd"
              metalness={0.8}
              roughness={0.2}
              emissive="#a78bfa"
              emissiveIntensity={0.5}
            />
          </mesh>
          {/* P 的圆弧部分 */}
          <mesh position={[0.1, 0.25, 0.02]}>
            <torusGeometry args={[0.35, 0.1, 16, 32, Math.PI]} />
            <meshStandardMaterial 
              color="#c4b5fd"
              metalness={0.8}
              roughness={0.2}
              emissive="#a78bfa"
              emissiveIntensity={0.5}
            />
          </mesh>
        </group>

        {/* 背面装饰星星 */}
        <group position={[0, -0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <mesh 
              key={i} 
              position={[
                Math.cos((angle * Math.PI) / 180) * 0.8,
                Math.sin((angle * Math.PI) / 180) * 0.8,
                0.02
              ]}
            >
              <circleGeometry args={[0.08, 6]} />
              <meshStandardMaterial 
                color="#fbbf24"
                metalness={0.9}
                roughness={0.1}
              />
            </mesh>
          ))}
        </group>
      </group>
    </Float>
  )
}

function Particles() {
  const count = 50
  const meshRef = useRef<THREE.InstancedMesh>(null)

  useFrame((state) => {
    if (!meshRef.current) return
    
    const time = state.clock.elapsedTime
    for (let i = 0; i < count; i++) {
      const matrix = new THREE.Matrix4()
      const position = new THREE.Vector3(
        Math.sin(time * 0.5 + i) * 4,
        Math.cos(time * 0.3 + i * 0.5) * 3,
        Math.sin(time * 0.2 + i * 0.3) * 2 - 3
      )
      matrix.setPosition(position)
      matrix.scale(new THREE.Vector3(0.02, 0.02, 0.02))
      meshRef.current.setMatrixAt(i, matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#a78bfa" transparent opacity={0.6} />
    </instancedMesh>
  )
}

export function Logo3D() {
  return (
    <div className="w-full h-[300px] md:h-[400px] relative">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} color="#fff" />
          <pointLight position={[-10, -10, -10]} intensity={0.5} color="#9333ea" />
          <spotLight
            position={[0, 5, 5]}
            angle={0.3}
            penumbra={1}
            intensity={1}
            color="#c4b5fd"
          />
          
          <Coin />
          <Particles />
          
          <Environment preset="city" />
        </Suspense>
      </Canvas>

      {/* 底部反射/阴影效果 */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-8 bg-purple-500/20 blur-2xl rounded-full" />
    </div>
  )
}
