import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'NEQTA — Copiloto de Precificação',description:'Inteligência de precificação para decisões melhores.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
