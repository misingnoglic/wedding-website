export default function FAQ() {
    const faqs = [
        {
            question: "When is the RSVP deadline?",
            answer: "Please RSVP by October 1, 2026, so we can have an accurate headcount. A formal RSVP link will be provided closer to the date.",
        },
        {
            question: "Are children welcome?",
            answer: "While we love your little ones, our wedding is going to be an adults-only event so that everyone can relax and enjoy the evening. We appreciate you making arrangements ahead of time and leaving the kids at home so you can celebrate with us.",
        },
        {
            question: "What is the dress code?",
            answer: "The dress code is Cocktail Attire. We suggest that men wear a suit or dress shirt with tie and women wear a midi or knee-length dress or dressy separates. Please note the ceremony will be outdoors.",
        },
        {
            question: "Will the wedding be indoors or outdoors?",
            answer: "Both the ceremony and reception will be held outdoors, offering beautiful views of the Cabo sunset. We recommend bringing a light shawl or jacket for the evening.",
        },
    ];

    return (
        <div className="w-full max-w-3xl px-4 py-16 md:py-24 animate-fade-in text-left">
            <h1 className="text-5xl md:text-7xl font-script mb-16 text-center">Frequently Asked Questions</h1>

            <div className="space-y-8">
                {faqs.map((faq, index) => (
                    <div key={index} className="border-b border-zinc-200 dark:border-zinc-800 pb-6">
                        <h3 className="text-xl font-sans font-medium mb-3 text-black dark:text-white">
                            {faq.question}
                        </h3>
                        <p className="text-zinc-600 dark:text-zinc-400 font-karla leading-relaxed">
                            {faq.answer}
                        </p>
                    </div>
                ))}
            </div>

            <div className="mt-16 text-center">
                <p className="text-zinc-500 font-karla">
                    Have more questions?{" "}
                    <a href="/contact" className="text-sage hover:underline underline-offset-4">
                        Contact us
                    </a>
                </p>
            </div>
        </div>
    );
}
