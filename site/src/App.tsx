import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Integrations } from './components/Integrations';
import { Features } from './components/Features';
import { Support } from './components/Support';
import { Footer } from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen overflow-x-clip">
      <Header />
      <main>
        <Hero />
        <Integrations />
        <Features />
        <Support />
      </main>
      <Footer />
    </div>
  );
}
