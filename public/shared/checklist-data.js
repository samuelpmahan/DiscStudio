export const defaultChecklist = [
  {
    id: 'photo-intake',
    label: 'Photo intake',
    parts: [
      { id: 'original-photo', label: 'Original photo' },
      { id: 'oriented-image', label: 'Oriented image' }
    ]
  },
  {
    id: 'disc-framing',
    label: 'Disc framing',
    parts: [
      { id: 'crop-geometry', label: 'Crop geometry' },
      { id: 'correction-parameters', label: 'Correction parameters' }
    ]
  },
  {
    id: 'prepared-image',
    label: 'Prepared image',
    parts: [
      { id: 'circular-mask', label: 'Circular mask' },
      { id: 'transparent-disc-image', label: 'Transparent disc image' }
    ]
  },
  {
    id: 'shelf-insertion',
    label: 'Shelf insertion',
    parts: [
      { id: 'physical-disc', label: 'Physical disc' },
      { id: 'shelf-membership', label: 'Shelf membership' }
    ]
  }
];
