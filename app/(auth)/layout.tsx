import { Navbar } from '@/components/shared/navbar';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </>
  );
}
