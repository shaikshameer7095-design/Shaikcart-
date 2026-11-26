import React from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { MiniCartDrawer } from './MiniCartDrawer';
import { ToastContainer } from './ToastContainer';

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FC] text-[#0F0D2E]">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <MiniCartDrawer />
      <ToastContainer />
    </div>
  );
}
