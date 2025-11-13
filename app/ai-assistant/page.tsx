
'use client'

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DocumentProcessor } from "@/components/ai-assistant/document-processor"
import { 
  Bot,
  Upload,
  FileText,
  Image,
  File,
  Send,
  Paperclip,
  Loader,
  Check,
  X,
  FolderOpen,
  Building2,
  Users,
  ShoppingCart,
  Calculator,
  Download,
  Eye,
  Trash2,
  MessageSquare,
  Sparkles,
  BrainCircuit,
  FileSearch,
  Tag,
  ArrowUpRight
} from "lucide-react"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"

interface ProcessedDocument {
  id: string
  filename: string
  fileType: string
  fileSize: number
  cloudStoragePath: string
  assignedTo?: {
    type: 'project' | 'client' | 'vendor' | 'tender' | 'quotation' | 'invoice'
    id: string
    name: string
  }
  aiAnalysis?: {
    summary: string
    documentType: string
    keyInformation: string[]
    suggestedAssignment?: {
      type: string
      confidence: number
      reason: string
    }
  }
  uploadedAt: string
  processedAt?: string
  status: 'uploading' | 'processing' | 'completed' | 'failed'
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  attachments?: {
    filename: string
    fileType: string
    cloudStoragePath: string
  }[]
}

interface EntityOption {
  id: string
  name: string
  type: 'project' | 'client' | 'vendor' | 'tender' | 'quotation' | 'invoice'
  subtitle?: string
}

export default function AIAssistantPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState("chat")
  const [loading, setLoading] = useState(true)
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  // Document processing state
  const [documents, setDocuments] = useState<ProcessedDocument[]>([])
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([])
  const [dragActive, setDragActive] = useState(false)
  
  // Entity options for assignment
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([])
  const [selectedEntity, setSelectedEntity] = useState<string>("")

  const userRole = session?.user?.role
  const canUseAI = ["SUPERADMIN", "FINANCE", "PROJECT_MANAGER"].includes(userRole || "")

  useEffect(() => {
    if (canUseAI) {
      loadInitialData()
    }
    setLoading(false)
  }, [canUseAI])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, isTyping])

  const loadInitialData = async () => {
    try {
      // Load existing documents
      const docsResponse = await fetch('/api/ai-assistant/documents')
      if (docsResponse.ok) {
        const docs = await docsResponse.json()
        setDocuments(docs)
      }

      // Load entity options for assignment
      const entitiesResponse = await fetch('/api/ai-assistant/entities')
      if (entitiesResponse.ok) {
        const entities = await entitiesResponse.json()
        setEntityOptions(entities)
      }

      // Load chat history
      const chatResponse = await fetch('/api/ai-assistant/chat/history')
      if (chatResponse.ok) {
        const history = await chatResponse.json()
        setChatMessages(history)
      }
    } catch (error) {
      console.error('Failed to load initial data:', error)
    }
  }

  const handleFileUpload = async (files: File[]) => {
    const newUploadingFiles = files.map(f => f.name)
    setUploadingFiles(prev => [...prev, ...newUploadingFiles])

    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch('/api/ai-assistant/documents/upload', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const result = await response.json()
          
          // Add to documents list with processing status
          const newDoc: ProcessedDocument = {
            id: result.id,
            filename: file.name,
            fileType: file.type || 'application/octet-stream',
            fileSize: file.size,
            cloudStoragePath: result.cloudStoragePath,
            uploadedAt: new Date().toISOString(),
            status: 'processing'
          }
          
          setDocuments(prev => [newDoc, ...prev])
          
          // Start AI processing
          processDocumentWithAI(result.id)
          
          toast.success(`${file.name} uploaded successfully`)
        } else {
          throw new Error('Upload failed')
        }
      } catch (error) {
        console.error('File upload failed:', error)
        toast.error(`Failed to upload ${file.name}`)
      }
      
      setUploadingFiles(prev => prev.filter(f => f !== file.name))
    }
  }

  const processDocumentWithAI = async (documentId: string) => {
    try {
      const response = await fetch('/api/ai-assistant/documents/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ documentId })
      })

      if (response.ok) {
        const result = await response.json()
        
        // Update document with AI analysis
        setDocuments(prev => prev.map(doc => 
          doc.id === documentId 
            ? {
                ...doc,
                status: 'completed',
                processedAt: new Date().toISOString(),
                aiAnalysis: result.analysis
              }
            : doc
        ))
        
        toast.success('Document processed successfully')
      } else {
        throw new Error('Processing failed')
      }
    } catch (error) {
      console.error('Document processing failed:', error)
      setDocuments(prev => prev.map(doc => 
        doc.id === documentId ? { ...doc, status: 'failed' } : doc
      ))
      toast.error('Document processing failed')
    }
  }

  const handleAssignDocument = async (documentId: string, entityType: string, entityId: string) => {
    try {
      const response = await fetch('/api/ai-assistant/documents/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          documentId, 
          entityType, 
          entityId 
        })
      })

      if (response.ok) {
        const entity = entityOptions.find(e => e.id === entityId)
        
        setDocuments(prev => prev.map(doc => 
          doc.id === documentId 
            ? {
                ...doc,
                assignedTo: {
                  type: entityType as any,
                  id: entityId,
                  name: entity?.name || 'Unknown'
                }
              }
            : doc
        ))
        
        toast.success('Document assigned successfully')
      } else {
        throw new Error('Assignment failed')
      }
    } catch (error) {
      console.error('Document assignment failed:', error)
      toast.error('Failed to assign document')
    }
  }

  const sendMessage = async () => {
    if (!currentMessage.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage,
      timestamp: new Date().toISOString()
    }

    setChatMessages(prev => [...prev, userMessage])
    setCurrentMessage("")
    setIsTyping(true)

    try {
      const response = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: currentMessage,
          history: chatMessages.slice(-10) // Send last 10 messages for context
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                setIsTyping(false)
                return
              }
              
              try {
                const parsed = JSON.parse(data)
                if (parsed.choices?.[0]?.delta?.content) {
                  assistantMessage += parsed.choices[0].delta.content
                  
                  // Update the last assistant message or create new one
                  setChatMessages(prev => {
                    const messages = [...prev]
                    const lastMessage = messages[messages.length - 1]
                    
                    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id === 'streaming') {
                      lastMessage.content = assistantMessage
                      return messages
                    } else {
                      return [...messages, {
                        id: 'streaming',
                        role: 'assistant',
                        content: assistantMessage,
                        timestamp: new Date().toISOString()
                      }]
                    }
                  })
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat failed:', error)
      toast.error('Failed to get AI response')
      setIsTyping(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    
    const files = Array.from(e.dataTransfer.files)
    handleFileUpload(files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />
    if (fileType.includes('pdf')) return <FileText className="h-4 w-4 text-red-600" />
    return <File className="h-4 w-4" />
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading': return <Loader className="h-4 w-4 animate-spin" />
      case 'processing': return <BrainCircuit className="h-4 w-4 animate-pulse text-blue-600" />
      case 'completed': return <Check className="h-4 w-4 text-green-600" />
      case 'failed': return <X className="h-4 w-4 text-red-600" />
      default: return null
    }
  }

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'project': return <FolderOpen className="h-4 w-4 text-blue-600" />
      case 'client': return <Building2 className="h-4 w-4 text-green-600" />
      case 'vendor': return <Users className="h-4 w-4 text-purple-600" />
      case 'tender': return <ShoppingCart className="h-4 w-4 text-orange-600" />
      case 'quotation': return <Calculator className="h-4 w-4 text-red-600" />
      case 'invoice': return <FileText className="h-4 w-4 text-indigo-600" />
      default: return <File className="h-4 w-4" />
    }
  }

  if (!canUseAI) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Bot className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="text-gray-600 mt-2">You don't have permission to access the AI Assistant.</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
              <p className="text-gray-600">Document processing and intelligent assistance</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="bg-green-50 text-green-700">
              <BrainCircuit className="h-3 w-3 mr-1" />
              AI Powered
            </Badge>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat" className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <span>AI Chat</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BrainCircuit className="h-4 w-4" />
              <span>AI Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="processor" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Document Processing</span>
            </TabsTrigger>
          </TabsList>

          {/* AI Chat Tab */}
          <TabsContent value="chat" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Chat Interface */}
              <div className="lg:col-span-3">
                <Card className="h-[600px] flex flex-col">
                  <CardHeader className="flex-shrink-0">
                    <CardTitle className="flex items-center space-x-2">
                      <Bot className="h-5 w-5 text-blue-600" />
                      <span>AI Assistant Chat</span>
                    </CardTitle>
                    <CardDescription>
                      Ask me anything about your business, documents, or get help with tasks
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="flex-1 flex flex-col p-0">
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {chatMessages.length === 0 && (
                        <div className="text-center py-12">
                          <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to AI Assistant</h3>
                          <p className="text-gray-500 mb-4">
                            I can help you with document analysis, business questions, and task automation.
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-md mx-auto text-sm">
                            <div className="p-3 border rounded-lg text-left">
                              <div className="font-medium">Document Analysis</div>
                              <div className="text-gray-500">Upload and analyze documents</div>
                            </div>
                            <div className="p-3 border rounded-lg text-left">
                              <div className="font-medium">Business Insights</div>
                              <div className="text-gray-500">Ask about projects, clients, finances</div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {chatMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              message.role === 'user'
                                ? 'bg-blue-600 text-white ml-12'
                                : 'bg-gray-100 text-gray-900 mr-12'
                            }`}
                          >
                            <div className="whitespace-pre-wrap">{message.content}</div>
                            <div className={`text-xs mt-1 ${
                              message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {format(new Date(message.timestamp), 'HH:mm')}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 text-gray-900 p-3 rounded-lg mr-12">
                            <div className="flex items-center space-x-2">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                              </div>
                              <span className="text-sm text-gray-500">AI is thinking...</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div ref={chatEndRef} />
                    </div>
                    
                    {/* Message Input */}
                    <div className="flex-shrink-0 border-t p-4">
                      <div className="flex items-end space-x-2">
                        <div className="flex-1">
                          <Textarea
                            value={currentMessage}
                            onChange={(e) => setCurrentMessage(e.target.value)}
                            placeholder="Ask me anything about your business..."
                            className="min-h-[40px] max-h-32 resize-none"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                sendMessage()
                              }
                            }}
                          />
                        </div>
                        <Button 
                          onClick={sendMessage} 
                          disabled={!currentMessage.trim() || isTyping}
                          size="icon"
                          className="h-10 w-10"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Quick Actions Sidebar */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <FileSearch className="h-4 w-4 mr-2" />
                      Analyze Documents
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <Tag className="h-4 w-4 mr-2" />
                      Auto-assign Files
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <BrainCircuit className="h-4 w-4 mr-2" />
                      Generate Insights
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Check className="h-3 w-3 text-green-600" />
                        <span>Document processed</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Tag className="h-3 w-3 text-blue-600" />
                        <span>Auto-assigned to project</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <FileSearch className="h-3 w-3 text-purple-600" />
                        <span>Invoice analyzed</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* AI Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <FileSearch className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Documents Processed</p>
                      <p className="text-2xl font-bold">{documents.filter(d => d.status === 'completed').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Tag className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Auto-assigned</p>
                      <p className="text-2xl font-bold">{documents.filter(d => d.assignedTo).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">Chat Messages</p>
                      <p className="text-2xl font-bold">{chatMessages.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <BrainCircuit className="h-8 w-8 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-600">AI Accuracy</p>
                      <p className="text-2xl font-bold">94%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Document Processing Insights</CardTitle>
                <CardDescription>
                  AI analysis results and document categorization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <BrainCircuit className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Analytics dashboard coming soon...</p>
                  <p className="text-sm">AI insights and trends will be displayed here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Document Processing Tab */}
          <TabsContent value="processor" className="space-y-4">
            <DocumentProcessor />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}
