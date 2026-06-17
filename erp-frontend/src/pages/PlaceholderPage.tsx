import { Construction } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <Construction size={64} className="mb-4 opacity-30" />
      <h2 className="text-xl font-semibold text-gray-500">{title}</h2>
      <p className="text-sm mt-2">{description || 'This module is under development. Check back soon.'}</p>
    </div>
  );
}
