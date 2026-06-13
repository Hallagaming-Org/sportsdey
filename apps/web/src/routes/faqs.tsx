import { createFileRoute } from '@tanstack/react-router';
import { Plus, Minus } from 'lucide-react';
import { useState } from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { motion, type Variants } from 'framer-motion';
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

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, x: -50 },
    show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 100, damping: 20 } }
  };

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
          value={activeItem}
          onValueChange={setActiveItem}
          asChild
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="w-full space-y-4"
          >
            {filteredFaqs.map((faq, index) => {
              const value = `item-${index}`;
              const isActive = activeItem === value;
              return (
                <Accordion.Item
                  key={value}
                  value={value}
                  asChild
                >
                  <motion.div
                    variants={itemVariants}
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
                  </motion.div>
                </Accordion.Item>
              );
            })}
          </motion.div>
        </Accordion.Root>

        {filteredFaqs.length === 0 && (
          <div className="py-10 text-center text-[#A0A0A0]">
            No matching questions found.
          </div>
        )}
      </div>
    </div>
  );
}
