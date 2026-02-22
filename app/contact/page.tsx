"use client";

import { useState } from "react";

export default function Contact() {
    const [formData, setFormData] = useState({ name: "", email: "" });
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // In the future this will connect to a database
        setSubmitted(true);
        setFormData({ name: "", email: "" });
        setTimeout(() => setSubmitted(false), 5000);
    };

    return (
        <div className="w-full max-w-3xl px-4 py-16 md:py-24 animate-fade-in text-center flex flex-col items-center">
            <h1 className="text-5xl md:text-7xl font-script mb-8">Get In Touch</h1>

            <p className="text-lg text-zinc-600 font-karla mb-16 max-w-xl">
                If you have any questions, feel free to reach out to us directly at{" "}
                <a
                    href="mailto:aryaandchrista@gmail.com"
                    className="text-sage hover:underline underline-offset-4"
                >
                    aryaandchrista@gmail.com
                </a>
            </p>

            <div className="w-full max-w-md bg-zinc-50 p-8 pt-10 rounded-sm border border-zinc-200">
                <h2 className="text-2xl font-sans mb-2">Stay Updated</h2>
                <p className="text-zinc-500 font-karla mb-6 text-sm">
                    Subscribe to get updates on the wedding weekend.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
                    <div className="flex flex-col gap-1">
                        <label htmlFor="name" className="text-sm font-sans tracking-wide uppercase text-zinc-600">
                            Name
                        </label>
                        <input
                            type="text"
                            id="name"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-zinc-300 focus:outline-none focus:border-sage transition-colors font-karla"
                            placeholder="Your Name"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label htmlFor="email" className="text-sm font-sans tracking-wide uppercase text-zinc-600">
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-zinc-300 focus:outline-none focus:border-sage transition-colors font-karla"
                            placeholder="your.email@example.com"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full mt-2 px-8 py-4 bg-black text-white font-sans tracking-wide uppercase text-sm hover:bg-sage hover:text-white transition-colors duration-300"
                    >
                        Subscribe
                    </button>

                    {submitted && (
                        <p className="text-sage text-sm text-center mt-2 font-karla animate-fade-in">
                            Thanks! You've been added to our list.
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
}
