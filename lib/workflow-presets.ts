export interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  stage: string;
  steps: string[];
  href: string;
}

export interface StarterTemplate {
  id: string;
  title: string;
  persona: string;
  description: string;
  href: string;
}

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: "idea-to-ranked-post",
    name: "Idea to Ranked Post",
    description: "Go from niche brainstorm to optimized article and publishing-ready draft.",
    stage: "Planning",
    steps: ["Generate ideas", "Run keyword brief", "Build outline", "Write article", "Review SEO score"],
    href: "/tool/blog-post-ideas?niche=Developer+productivity&count=10&format=How-to+guides",
  },
  {
    id: "youtube-repurpose-loop",
    name: "YouTube Repurpose Loop",
    description: "Turn transcript content into a long-form article with social derivatives.",
    stage: "Repurposing",
    steps: ["YouTube to blog", "Headline variants", "LinkedIn post", "X thread", "SEO optimization"],
    href: "/tool/youtube-to-blog?videoTitle=Weekly+Engineering+Recap&tone=Informative&length=Medium+%28~1500+words%29",
  },
  {
    id: "refresh-existing-content",
    name: "Refresh Existing Content",
    description: "Rewrite and optimize existing drafts to recover search performance.",
    stage: "Optimization",
    steps: ["Open history draft", "Rewrite weak sections", "SEO checklist", "Update WordPress draft"],
    href: "/history",
  },
];

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "onboarding-solo-operator",
    title: "Solo Operator Kickoff",
    persona: "Creator",
    description: "Set up a weekly flow using one article pipeline, one social repurpose flow, and one automation template.",
    href: "/automation",
  },
  {
    id: "onboarding-seo-team",
    title: "SEO Sprint Template",
    persona: "SEO",
    description: "Start with keyword research brief, outline generation, and SEO workspace scoring before publishing.",
    href: "/seo",
  },
  {
    id: "onboarding-editorial-ops",
    title: "Editorial Ops Board",
    persona: "Ops",
    description: "Use calendar ownership, review status, and publish intent to keep handoffs visible across the queue.",
    href: "/calendar",
  },
];
