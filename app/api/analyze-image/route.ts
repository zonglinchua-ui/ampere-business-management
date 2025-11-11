
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const context = formData.get('context') as string || 'construction project'
    const documentType = formData.get('documentType') as string || ''

    if (!file || !file.type.startsWith('image/')) {
      return NextResponse.json({ error: "Valid image file is required" }, { status: 400 })
    }

    // Convert image to base64
    const arrayBuffer = await file.arrayBuffer()
    const base64String = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type
    
    // Create contextual prompt based on document type
    let analysisPrompt = `Analyze this image in the context of a ${context}. `
    
    if (documentType) {
      const documentTypePrompts = {
        'PRE_CONSTRUCTION_SURVEY': 'This appears to be a pre-construction survey photo. Describe the existing conditions, structures, utilities, or site features visible in the image. Focus on elements that would be relevant for construction planning.',
        'DAILY_SITE_REPORT': 'This is a daily construction site photo. Describe the current work activities, progress, safety conditions, equipment, and personnel visible in the image.',
        'PROGRESS_PHOTOS': 'This is a construction progress photo. Describe the work completed, current stage of construction, materials being used, and overall progress visible in the image.',
        'INSPECTION_TEST_PLAN': 'This is an inspection or testing photo. Describe the components, systems, or work being inspected/tested, any visible defects or compliance issues.',
        'QUALITY_CHECKLIST': 'This is a quality control photo. Describe the workmanship quality, materials, installation details, and any quality issues or compliance with specifications.',
        'MATERIAL_DELIVERY_NOTE': 'This is a material delivery photo. Describe the materials, quantities, condition, delivery vehicle, and storage arrangements visible.',
        'INCIDENT_REPORT': 'This is an incident report photo. Describe the incident scene, any damage, safety hazards, people involved, and environmental conditions.',
        'ACCIDENT_REPORT': 'This is an accident report photo. Describe the accident scene, any injuries or damage, safety equipment, and conditions that led to the accident.',
        'AS_BUILT_DRAWINGS': 'This photo documents as-built conditions. Describe the installed systems, final configurations, access points, and any deviations from original plans.',
        'DEFECT_LIABILITY_REPORT': 'This is a defect inspection photo. Describe any defects, damage, wear, or maintenance issues visible in the completed work.',
        'NON_CONFORMANCE_REPORT': 'This photo documents non-conformance issues. Describe what doesn\'t meet specifications, standards, or requirements.',
        'OPERATION_MAINTENANCE_MANUAL': 'This photo supports operation and maintenance documentation. Describe the equipment, systems, components, access points, and maintenance requirements.',
        'TESTING_COMMISSIONING_REPORT': 'This is a testing and commissioning photo. Describe the systems being tested, test equipment, results, and commissioning activities.',
        'HANDOVER_FORM': 'This photo is for project handover documentation. Describe the completed work, final conditions, and items being handed over to the customer.',
        'FINAL_COMPLETION_CERTIFICATE': 'This photo documents final completion. Describe the finished project, final conditions, and compliance with contract requirements.',
        'WARRANTY_CERTIFICATE': 'This photo supports warranty documentation. Describe the warranted work, systems, or components and their condition.',
        'SERVICE_AGREEMENT': 'This photo relates to ongoing service requirements. Describe the systems, equipment, or areas requiring regular service or maintenance.'
      }
      
      if (documentTypePrompts[documentType as keyof typeof documentTypePrompts]) {
        analysisPrompt = documentTypePrompts[documentType as keyof typeof documentTypePrompts]
      }
    }

    analysisPrompt += `

Please provide a detailed, professional description that includes:
1. What is visible in the image
2. The condition of any structures, materials, or work
3. Any safety considerations or concerns
4. Relevant technical details for project documentation
5. Any notable features or issues that should be recorded

Keep the description factual, technical, and suitable for official project documentation. The description should be between 100-300 words.`

    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: analysisPrompt
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64String}`
            }
          }
        ]
      }
    ]

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: messages,
        max_tokens: 500,
        temperature: 0.3
      })
    })

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`)
    }

    const result = await response.json()
    const description = result.choices?.[0]?.message?.content || 'Unable to analyze image'

    // Also generate a suggested title based on the image
    const titleMessages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Based on this ${documentType ? documentType.toLowerCase().replace(/_/g, ' ') : 'construction'} image, suggest a brief, professional title (3-8 words) that would be suitable for project documentation.`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64String}`
            }
          }
        ]
      }
    ]

    const titleResponse = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: titleMessages,
        max_tokens: 50,
        temperature: 0.3
      })
    })

    let suggestedTitle = ''
    if (titleResponse.ok) {
      const titleResult = await titleResponse.json()
      suggestedTitle = titleResult.choices?.[0]?.message?.content || ''
    }

    return NextResponse.json({
      description,
      suggestedTitle,
      filename: file.name,
      size: file.size,
      type: file.type
    })

  } catch (error) {
    console.error("Error analyzing image:", error)
    return NextResponse.json(
      { error: "Failed to analyze image" },
      { status: 500 }
    )
  }
}
