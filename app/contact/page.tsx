export default function Contact() {
    return (
        <div className="w-full max-w-3xl px-4 py-8 md:py-12 animate-fade-in text-center flex flex-col items-center">
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
        </div>
    );
}
