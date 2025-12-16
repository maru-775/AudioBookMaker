"""
RSS feed endpoint for podcast apps.
"""
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from src.shared.database import get_db, Job
from src.shared.config import settings
import email.utils
import os

router = APIRouter()


@router.get("/api/rss")
async def rss_feed(db: Session = Depends(get_db)):
    jobs = db.query(Job).filter(Job.status == "completed").order_by(Job.created_at.desc()).all()
    
    # Use configurable base URL for production deployments
    base_url = settings.API_BASE_URL
    
    xml_items = []
    for job in jobs:
        pub_date = email.utils.format_datetime(job.created_at)
        download_url = f"{base_url}/api/download/{job.id}"
        
        file_size = 0
        if job.output_path and os.path.exists(job.output_path):
             try:
                file_size = os.path.getsize(job.output_path)
             except OSError:
                file_size = 0
             
        item = f"""
        <item>
            <title>{job.filename}</title>
            <link>{download_url}</link>
            <guid>{job.id}</guid>
            <pubDate>{pub_date}</pubDate>
            <description>Audiobook generated from {job.filename}</description>
            <enclosure url="{download_url}" length="{file_size}" type="audio/mpeg"/>
        </item>"""
        xml_items.append(item)
        
    rss_content = f"""<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
    <title>AudioBookMaker Feed</title>
    <link>{base_url}</link>
    <description>Your generated audiobooks</description>
    {''.join(xml_items)}
</channel>
</rss>
"""
    return Response(content=rss_content, media_type="application/xml")
