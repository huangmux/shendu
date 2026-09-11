#!/usr/bin/env python3
"""
Generate a sample PDF for testing the Deep Read application.
"""

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
import io

def create_sample_pdf():
    """Create a sample PDF with multiple chapters for testing."""
    
    # Create PDF in memory first, then write to file
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    
    # Get styles
    styles = getSampleStyleSheet()
    title_style = styles['Title']
    heading_style = styles['Heading1'] 
    normal_style = styles['Normal']
    
    # Content
    story = []
    
    # Title page
    story.append(Paragraph("深度学习基础教程", title_style))
    story.append(Spacer(1, 20))
    story.append(Paragraph("人工智能入门指南", styles['Heading2']))
    story.append(Spacer(1, 40))
    story.append(Paragraph("本教程将带您了解深度学习的基本概念和实践方法。", normal_style))
    story.append(PageBreak())
    
    # Chapter 1
    story.append(Paragraph("第一章 人工智能概述", heading_style))
    story.append(Spacer(1, 12))
    story.append(Paragraph("""
    人工智能（Artificial Intelligence，AI）是计算机科学的一个分支，
    它企图了解智能的实质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。
    
    人工智能的发展历程可以追溯到20世纪50年代，经历了多次起伏。
    从符号主义到连接主义，再到当今的深度学习，AI技术不断演进。
    
    当前，人工智能已经在图像识别、自然语言处理、推荐系统等领域
    取得了突破性进展，深刻改变着我们的生活和工作方式。
    """, normal_style))
    story.append(PageBreak())
    
    # Chapter 2  
    story.append(Paragraph("第二章 机器学习基础", heading_style))
    story.append(Spacer(1, 12))
    story.append(Paragraph("""
    机器学习是人工智能的一个重要分支，它使计算机能够在没有明确编程的情况下学习。
    
    机器学习主要分为三类：
    1. 监督学习：使用标记数据训练模型
    2. 无监督学习：从未标记数据中发现模式
    3. 强化学习：通过与环境交互来学习最优策略
    
    常见的机器学习算法包括线性回归、决策树、支持向量机、
    随机森林等。每种算法都有其适用的场景和优缺点。
    """, normal_style))
    story.append(PageBreak())
    
    # Chapter 3
    story.append(Paragraph("第三章 深度学习原理", heading_style)) 
    story.append(Spacer(1, 12))
    story.append(Paragraph("""
    深度学习是机器学习的一个子集，使用人工神经网络来模拟人脑的工作方式。
    
    神经网络的基本组成包括：
    - 输入层：接收原始数据
    - 隐藏层：进行特征提取和转换
    - 输出层：产生最终预测结果
    
    深度学习的"深度"指的是网络中隐藏层的数量。
    通过多层网络的组合，深度学习能够自动学习数据的
    层次化特征表示，在许多任务上超越了传统方法。
    """, normal_style))
    story.append(PageBreak())
    
    # Chapter 4
    story.append(Paragraph("第四章 实践应用案例", heading_style))
    story.append(Spacer(1, 12))
    story.append(Paragraph("""
    深度学习在各个领域都有广泛应用：
    
    1. 计算机视觉：
       - 图像分类和物体检测
       - 人脸识别和医学影像分析
       - 自动驾驶汽车的视觉系统
    
    2. 自然语言处理：
       - 机器翻译和文本生成
       - 智能客服和对话系统
       - 情感分析和文档理解
    
    3. 语音技术：
       - 语音识别和语音合成
       - 智能音箱和语音助手
    
    这些应用正在改变我们的生活，展现了人工智能的巨大潜力。
    """, normal_style))
    
    # Build PDF
    doc.build(story)
    
    # Write to file
    buffer.seek(0)
    with open('sample-textbook.pdf', 'wb') as f:
        f.write(buffer.getvalue())
    
    print("Sample PDF created: sample-textbook.pdf")

if __name__ == "__main__":
    try:
        create_sample_pdf()
    except ImportError:
        print("reportlab not installed. Installing...")
        import subprocess
        subprocess.check_call(["pip", "install", "reportlab"])
        create_sample_pdf()