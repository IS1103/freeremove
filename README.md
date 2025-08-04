# AI Background Remover

An intelligent image background removal tool built with Next.js, featuring magic wand and color picker tools with blur edge effects and multi-selection capabilities.

## Live Demo

**Try it now:** [https://freeremove.onrender.com/](https://freeremove.onrender.com/)

## Features

- **Magic Wand Tool**: Click on similar color areas for intelligent selection with multi-select support
- **Color Picker Tool**: Select specific colors for batch removal
- **Blur Edges**: Automatically add soft edge effects for more natural results
- **Drag & Drop Upload**: Support direct image drag and drop to editing area
- **Real-time Preview**: Instant selection area display for intuitive operation
- **Parameter Adjustment**: Adjustable tolerance and blur intensity

## Tech Stack

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/components/BackgroundRemover.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Usage Guide

### Magic Wand Tool
- Click on areas of the image you want to remove
- Automatically selects similar colored areas
- Supports multi-selection, can click multiple areas continuously
- All selections are automatically merged

### Color Picker Tool
- Click on the image to select the color you want to remove
- Click the "Apply Color Selection" button
- Selects all areas with similar colors

### Parameter Adjustment
- **Tolerance**: Adjust the looseness of color matching, higher values mean wider selection range
- **Blur Intensity**: Adjust the blur level of the final image for more natural edges

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
