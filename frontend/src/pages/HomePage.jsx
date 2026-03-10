import HeroSection from "../components/sections/HeroSection";
import FeaturesOverview from "../components/sections/FeaturesOverview";
import HowItWorks from "../components/sections/HowItWorks";
import CategoriesSection from "../components/sections/CategoriesSection";
import DiffCheckerSection from "../components/sections/DiffCheckerSection";
import LegalChatSection from "../components/sections/LegalChatSection";
import CTASection from "../components/sections/CTASection";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturesOverview />
      <HowItWorks />
      <CategoriesSection />
      <DiffCheckerSection />
      <LegalChatSection />
      <CTASection />
    </>
  );
}
