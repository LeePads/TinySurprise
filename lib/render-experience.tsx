import { CatchTheHeartExperience } from "@/components/experiences/catch-the-heart-experience";
import { PhotoPuzzleExperience } from "@/components/experiences/photo-puzzle-experience";
import { OpenWhenExperience } from "@/components/experiences/open-when-experience";
import { ChooseOurDateExperience } from "@/components/experiences/choose-our-date-experience";
import { MemoryQuizExperience } from "@/components/experiences/memory-quiz-experience";
import { OurStorybookExperience } from "@/components/experiences/storybook-experience";
import { WishUponAStarExperience } from "@/components/experiences/wish-upon-a-star-experience";
import { CozyPlaylistExperience } from "@/components/experiences/cozy-playlist-experience";
import type { SurpriseData } from "@/lib/types";

/**
 * Picks the recipient-facing experience component for a template. Shared by
 * the builder (app/create/[template]/create-client.tsx) and the /viewer
 * route so the template->component switch only lives in one place.
 */
export function getExperienceComponent(data: SurpriseData): React.ReactNode {
  switch (data.template) {
    case "catch-the-heart":
      return <CatchTheHeartExperience data={data} />;
    case "photo-puzzle":
      return <PhotoPuzzleExperience data={data} />;
    case "open-when":
      return <OpenWhenExperience data={data} />;
    case "choose-our-date":
      return <ChooseOurDateExperience data={data} />;
    case "memory-quiz":
      return <MemoryQuizExperience data={data} />;
    case "our-storybook":
      return <OurStorybookExperience data={data} />;
    case "wish-upon-a-star":
      return <WishUponAStarExperience data={data} />;
    default:
      return <CozyPlaylistExperience data={data} />;
  }
}
