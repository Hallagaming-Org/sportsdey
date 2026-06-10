import { createFileRoute } from '@tanstack/react-router';
import { Search, Plus, Minus } from 'lucide-react';
import { useState } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { faqs } from '../data/faqs';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/faqs')({
  component: FAQs,
});

function FAQs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeItem, setActiveItem] = useState<string | undefined>(undefined);

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (typeof faq.answer === 'string' && faq.answer.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#000606] text-white py-12 px-4 flex flex-col items-center">
      <div className="w-full max-w-3xl flex flex-col items-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-center">Frequently Asked Questions</h1>
        <p className="text-[#A0A0A0] mb-8 text-center text-sm sm:text-base">
          Get quick answers to questions you may have.
        </p>

        {/* <div className="relative w-full mb-10">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-b border-[#2F3033] py-3 pr-10 text-white placeholder-[#6E6E6E] outline-none focus:border-[#00FF00] transition-colors"
          />
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6E6E6E] w-5 h-5 pointer-events-none" />
        </div> */}

        <Accordion.Root
          type="single"
          collapsible
          className="w-full space-y-4"
          value={activeItem}
          onValueChange={setActiveItem}
        >
          {filteredFaqs.map((faq, index) => {
            const value = `item-${index}`;
            const isActive = activeItem === value;
            return (
              <Accordion.Item
                key={value}
                value={value}
                className={cn(
                  "rounded-lg border px-5 py-2 transition-colors cursor-pointer",
                  isActive
                    ? "border-[#00FF00] bg-[#000606]"
                    : "border-[#1A1A1A] bg-transparent"
                )}
              >
                <Accordion.Header className="flex">
                  <Accordion.Trigger className="flex flex-1 items-center justify-between outline-none group text-left py-4">
                    <span className={cn(
                      "font-medium text-sm sm:text-base pr-4",
                      isActive ? "text-[#00FF00]" : "text-white"
                    )}>
                      {faq.question}
                    </span>
                    <span className={cn(
                      "flex-shrink-0 transition-colors",
                      isActive ? "text-[#00FF00]" : "text-[#6E6E6E]"
                    )}>
                      {isActive ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </span>
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <div className="pt-2 pb-4 text-[#A0A0A0] leading-relaxed">
                    {faq.answer}
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            );
          })}
        </Accordion.Root>

        {filteredFaqs.length === 0 && (
          <div className="py-10 text-center text-[#A0A0A0]">
            No matching questions found.
          </div>
        )}

        <div className="mt-20 w-full flex flex-col items-center bg-[#0B100E] border border-[#1A1A1A] rounded-2xl p-8 sm:p-10 text-center">
          <h3 className="text-xl font-bold mb-2">Still have questions?</h3>
          <p className="text-[#A0A0A0] text-sm mb-8">
            Can't find the answer you're looking for? Contact us directly on WhatsApp.
          </p>
          <a 
            href="https://wa.me/2340000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#25D366] hover:bg-[#1EBE5C] text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
              <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
            </svg>
            Contact Us on WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
