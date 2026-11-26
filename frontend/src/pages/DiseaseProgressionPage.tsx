import { useState } from 'react';
import type { SupportedCropId } from '../models/agronomicTimelineModel.ts';
import { DiseaseProgressionViewer } from '../components/DiseaseProgressionViewer/DiseaseProgressionViewer.tsx';
import { CompactCropSelectorRail } from '../components/DiseaseProgressionViewer/CompactCropSelectorRail.tsx';
import { DEFAULT_CROP_SPECIMENS } from '../components/DiseaseProgressionViewer/types.ts';
import { AppHeader } from '../components/ui/AppHeader.tsx';

const HOW_IT_WORKS = [
  { title: 'Real leaf photos', body: 'Each stage is a picture of the same leaf, from healthy to severe.' },
  { title: 'Weather sets the pace', body: 'Warmer, wetter days make the disease move faster.' },
  { title: 'Treat and compare', body: 'Pick a day to spray and see how far the disease still gets.' },
] as const;

export function DiseaseProgressionPage() {
  const [selectedCrop, setSelectedCrop] = useState<SupportedCropId>('tomato');
  const [currentProgress, setCurrentProgress] = useState<number>(0);

  return (
    <div className="ui-page min-h-screen antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ui-ink focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <AppHeader />

      <main id="main" className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <div className="text-center">
          <h1 className="text-[36px] font-medium leading-[1.08] tracking-[-0.025em] text-ui-ink sm:text-5xl">Watch a disease grow</h1>
          <p className="mx-auto mt-3 max-w-lg text-balance text-[17px] leading-relaxed text-ui-ink-2">
            Pick a crop and drag the timeline to see how the leaf changes, day by day.
          </p>
        </div>

        <section aria-label="Choose a crop" className="mt-10">
          <CompactCropSelectorRail crops={DEFAULT_CROP_SPECIMENS} selectedCrop={selectedCrop} onSelectCrop={setSelectedCrop} />
        </section>

        <section aria-label="Disease progression" className="mt-6">
          <DiseaseProgressionViewer
            key={selectedCrop}
            cropId={selectedCrop}
            initialPercentage={currentProgress}
            onPercentageChange={setCurrentProgress}
          />
        </section>

        <section aria-labelledby="how-title" className="mt-20">
          <h2 id="how-title" className="text-center text-2xl font-medium tracking-[-0.01em] text-ui-ink sm:text-[28px]">
            How it works
          </h2>
          <ul role="list" className="mt-8 grid gap-8 sm:grid-cols-3">
            {HOW_IT_WORKS.map((point, index) => (
              <li key={point.title} className="border-t border-ui-line pt-5">
                <span className="text-sm tabular-nums text-ui-ink-3">0{index + 1}</span>
                <h3 className="mt-1 text-base font-medium text-ui-ink">{point.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ui-ink-2">{point.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
